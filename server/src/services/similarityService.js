const {riskConfig}=require('../config/risk');
function createSimilarityService(db) {
 return async (embedding,category)=>{
  const result=await db.query(`SELECT id,category,text,risk_level,rationale,1-(embedding <=> $1::vector) AS similarity FROM baseline_clauses WHERE ($2::text IS NULL OR category=$2) ORDER BY embedding <=> $1::vector LIMIT $3`,[JSON.stringify(embedding),category==='Other'?null:category,riskConfig.topK]);
  return result.rows;
 };
}
module.exports={createSimilarityService};
