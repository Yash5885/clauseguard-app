const data=require('../src/data/baselineClauses.json');
const {categories}=require('../src/config/categories');
const {normalize,createEmbeddingService}=require('../src/services/embeddingService');
const {retry}=require('../src/utils/limiter');
test('128 distinct curated baselines have exact per-category risk distribution',()=>{
 expect(data).toHaveLength(128);expect(new Set(data.map(r=>r.text)).size).toBe(128);
 for(const category of categories){const rows=data.filter(r=>r.category===category);expect(rows).toHaveLength(16);expect(rows.filter(r=>r.risk_level==='safe')).toHaveLength(6);expect(rows.filter(r=>r.risk_level==='caution')).toHaveLength(5);expect(rows.filter(r=>r.risk_level==='risky')).toHaveLength(5);}
});
test('normalizes vectors and batches document retrieval embeddings',async()=>{
 const embed=jest.fn(async texts=>({embeddings:texts.map(()=>({values:Array(768).fill(2)}))}));
 const result=await createEmbeddingService({embed})(Array(17).fill('clause'),'RETRIEVAL_DOCUMENT');
 expect(embed).toHaveBeenCalledTimes(2);expect(embed.mock.calls[0][1]).toBe('RETRIEVAL_DOCUMENT');
 expect(result[0].reduce((s,n)=>s+n*n,0)).toBeCloseTo(1);expect(()=>normalize([1])).toThrow();expect(()=>normalize(Array(768).fill(0))).toThrow();
});
test('rate limits retry with exponential backoff',async()=>{
 const call=jest.fn().mockRejectedValueOnce({status:429}).mockRejectedValueOnce({status:503}).mockResolvedValue('ok');const sleep=jest.fn();
 expect(await retry(call,{sleep,random:()=>0})).toBe('ok');expect(sleep.mock.calls).toEqual([[1000],[2000]]);
 await expect(retry(()=>Promise.reject({status:400}),{sleep})).rejects.toEqual({status:400});
});
