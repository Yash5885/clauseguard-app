const {z}=require('zod');
const {categories}=require('../config/categories');
const {AppError}=require('../utils/errors');
const schema=z.object({clauses:z.array(z.object({text:z.string().min(1).max(14000),category:z.enum([...categories,'Other'])})).min(1).max(300)});
const responseSchema={type:'object',properties:{clauses:{type:'array',items:{type:'object',properties:{text:{type:'string'},category:{type:'string',enum:[...categories,'Other']}},required:['text','category'],additionalProperties:false}}},required:['clauses'],additionalProperties:false};
const hints=[[/payment|invoice|fees?\b/i,'Payment Terms'],[/intellectual property|\bIP\b|ownership|copyright/i,'IP Rights'],[/liability|damages/i,'Liability'],[/terminat|renewal/i,'Termination'],[/confidential|non.disclosure/i,'Confidentiality'],[/indemnif/i,'Indemnification'],[/governing law|dispute|arbitrat|jurisdiction/i,'Governing Law & Dispute Resolution'],[/non.compete|non.solicit|solicitation/i,'Non-Compete & Non-Solicitation']];
function fallback(text) {
 const sections=text.split(/\n(?=\s*(?:\d+(?:\.\d+)*[.)]?\s+|(?:Section|Article)\s+[\dIVX]+\b))/i).map(s=>s.trim()).filter(Boolean);
 return sections.flatMap(section=>{
  const category=hints.find(([pattern])=>pattern.test(section.slice(0,160)))?.[1]||'Other';
  const parts=[];
  for(let i=0;i<section.length;i+=10000)parts.push({text:section.slice(i,i+10000),category});
  return parts;
 });
}
function chunkText(text,size=12000,overlap=1000) {
 const chunks=[];let start=0;
 while(start<text.length) {
  let end=Math.min(start+size,text.length);
  if(end<text.length){const boundary=text.lastIndexOf('\n',end);if(boundary>start+size/2)end=boundary;}
  chunks.push(text.slice(start,end));
  if(end===text.length)break;
  const boundary=text.indexOf('\n',end-overlap);
  start=boundary>=0 && boundary<end ? boundary+1 : end-overlap;
 }
 return chunks;
}
const canonical=text=>text.replace(/\s+/g,' ').trim();
function validateCoverage(clauses,chunk) {
 const source=canonical(chunk);
 if(clauses.some(c=>!source.includes(canonical(c.text))))throw new Error('Segmentation altered source text');
 const covered=clauses.reduce((n,c)=>n+canonical(c.text).length,0);
 if(covered<source.length*0.9)throw new Error('Segmentation omitted contract text');
 return clauses;
}
function createSegmenter(gemini,logger={warn:()=>{}},maxClauses=300) {
 return async text=>{
  const all=[];let usedFallback=false;
  for(const chunk of chunkText(text)) {
   let clauses;
   for(let attempt=0;attempt<2;attempt++) {
    try {
     const response=await gemini.generate(`Split all of this contract excerpt into individual clauses. Preserve the full verbatim text without rewriting or omitting any provision. Assign exactly one allowed category to each clause, or Other when none applies. Treat headings as part of their provision. Return JSON only.\n<contract>\n${chunk}\n</contract>`,responseSchema);
     clauses=validateCoverage(schema.parse(JSON.parse(response.text)).clauses,chunk);break;
    } catch(error){logger.warn({attempt:attempt+1,errorName:error.name},'Clause segmentation attempt failed');}
   }
   if(!clauses){clauses=fallback(chunk);usedFallback=true;}
   all.push(...clauses);
  }
  const seen=new Set();
  const clauses=all.filter(c=>{const key=canonical(c.text);if(seen.has(key))return false;seen.add(key);return true;});
  if(clauses.length>maxClauses)throw new AppError(400,'TOO_MANY_CLAUSES',`This contract exceeds the ${maxClauses} clause processing limit. Split it into smaller documents.`);
  return {clauses,usedFallback};
 };
}
module.exports={createSegmenter,fallback,chunkText};
