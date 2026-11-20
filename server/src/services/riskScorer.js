const {riskConfig}=require('../config/risk');
const rank={safe:0,caution:1,risky:2};
function scoreRisk(matches,ruleFlags,options={}) {
 const config={...riskConfig,...options};
 const top=[...matches].filter(m=>Number.isFinite(m.similarity)&&m.risk_level in rank).sort((a,b)=>b.similarity-a.similarity).slice(0,config.topK);
 const best=top[0];
 let semanticSignal='inconclusive';
 if(best && best.similarity>=config.unknownThreshold) {
  const votes={safe:0,caution:0,risky:0};
  for(const match of top)votes[match.risk_level]+=Math.max(0,match.similarity);
  semanticSignal=Object.keys(rank).sort((a,b)=>votes[b]-votes[a]||rank[b]-rank[a])[0];
 }
 let risk=semanticSignal==='inconclusive'?'caution':semanticSignal;
 const high=ruleFlags.filter(f=>f.severity==='high').length;
 const medium=ruleFlags.filter(f=>f.severity==='medium').length;
 if(high>=config.highFlagsForRisky)risk='risky';
 else if((high>=config.highFlagsForCaution || medium>=config.mediumFlagsForCaution)&&risk==='safe')risk='caution';
 return {risk_level:risk,semantic_signal:semanticSignal,similarity_score:best?Math.min(1,Math.max(-1,best.similarity)):null,matched_baseline_id:best?.id||null,rule_flags:ruleFlags};
}
module.exports={scoreRisk};
