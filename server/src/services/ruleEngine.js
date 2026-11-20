const rules=require('../config/rules.json');
const words={ninety:90,'one hundred and twenty':120,eighteen:18,'twenty-four':24,'twenty four':24,two:2,three:3,five:5};
const matches=(pattern,text)=>new RegExp(pattern,'i').test(text);
function runRules(category,text,config=rules) {
 return config.filter(rule=>{
  if(rule.category!=='*' && rule.category!==category)return false;
  if(rule.pattern && !matches(rule.pattern,text))return false;
  if(rule.requires && !matches(rule.requires,text))return false;
  if(rule.exclude && matches(rule.exclude,text))return false;
  if(rule.absent && matches(rule.absent,text))return false;
  if(rule.duration) {
   const found=[...text.matchAll(new RegExp(rule.duration.pattern,'gi'))];
   return found.some(match=>{
    const value=Number(match[1])||words[match[1].toLowerCase()]||0;
    const multiplier=rule.duration.unit==='months' && /^year/i.test(match[2]||'')?12:1;
    return value*multiplier>rule.duration.above;
   });
  }
  return true;
 }).map(({name,severity})=>({name,severity}));
}
module.exports={runRules};
