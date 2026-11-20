const {AppError}=require('../utils/errors');
const {runRules}=require('./ruleEngine');
const {scoreRisk}=require('./riskScorer');
const {DISCLAIMER}=require('./explanationService');
function createAnalysisPipeline({db,extract,segment,embed,search,explain,config,logger}) {
 return async function processAnalysis(analysis,fileBuffer){
  const {id,user_id:userId}=analysis;
  try {
   const started=await db.query("UPDATE analyses SET status='processing' WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING id",[id,userId]);
   if(!started.rowCount)return;
   const counts=await db.query('SELECT category,count(*)::int AS n FROM baseline_clauses GROUP BY category');
   if(counts.rows.length!==8 || counts.rows.some(r=>r.n<16))throw new AppError(503,'BASELINES_MISSING','The reference library is not ready. Please try again later.');
   const text=await extract(fileBuffer,analysis.file_type,config.MAX_TEXT_CHARACTERS);
   const segmented=await segment(text);
   if(!segmented.clauses.length)throw new AppError(400,'NO_CLAUSES','No contract clauses could be identified.');
   const embeddings=await embed(segmented.clauses.map(c=>c.text));
   const rows=[];
   for(let position=0;position<segmented.clauses.length;position++) {
    const clause=segmented.clauses[position];const matches=await search(embeddings[position],clause.category);
    const result=scoreRisk(matches,runRules(clause.category,clause.text),{unknownThreshold:config.UNKNOWN_THRESHOLD});
    const explanation=result.risk_level==='safe'?{explanation:null,suggested_rewording:null}:await explain(clause.text,matches,result);
    rows.push({...clause,...result,...explanation,position});
   }
   const summary={safe:0,caution:0,risky:0,total:rows.length,inconclusive:0,segmentation_fallback:segmented.usedFallback,disclaimer:DISCLAIMER};
   for(const row of rows){summary[row.risk_level]++;if(row.semantic_signal==='inconclusive')summary.inconclusive++;}
   const overall=summary.risky?'risky':summary.caution?'caution':'safe';
   await db.transaction(async client=>{
    const owner=await client.query("SELECT id FROM analyses WHERE id=$1 AND user_id=$2 AND status='processing' FOR UPDATE",[id,userId]);
    if(!owner.rowCount)throw new Error('Analysis no longer available');
    for(const c of rows)await client.query('INSERT INTO clauses(analysis_id,position,category,text,risk_level,similarity_score,matched_baseline_id,rule_flags,explanation,suggested_rewording,semantic_signal) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,c.position,c.category,c.text,c.risk_level,c.similarity_score,c.matched_baseline_id,JSON.stringify(c.rule_flags),c.explanation,c.suggested_rewording,c.semantic_signal]);
    await client.query("UPDATE analyses SET status='completed',overall_risk=$3,summary=$4,completed_at=now(),error_message=NULL WHERE id=$1 AND user_id=$2",[id,userId,overall,JSON.stringify(summary)]);
   });
  }catch(error){
   logger.error({err:error,analysisId:id},'Analysis failed');
   const message=error instanceof AppError?error.message:'The analysis could not be completed. Please try again. If this continues, contact support.';
   await db.query("UPDATE analyses SET status='failed',error_message=$3,completed_at=now() WHERE id=$1 AND user_id=$2",[id,userId,message]);
  }
 };
}
async function recoverAnalyses(db){await db.query("UPDATE analyses SET status='failed',error_message='The server restarted before the analysis finished. Please upload the contract again.',completed_at=now() WHERE status IN ('pending','processing')");}
module.exports={createAnalysisPipeline,recoverAnalyses};
