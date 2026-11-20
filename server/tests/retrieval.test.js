const {createExplanationService}=require('../src/services/explanationService');
const {createSimilarityService}=require('../src/services/similarityService');
const {createDatabase}=require('../src/db');
test('safe clauses do not call generation; flagged explanations receive only supplied context',async()=>{
 const generate=jest.fn().mockResolvedValue({text:JSON.stringify({explanation:'This clause resembles the supplied broad obligation. Consider limiting it to direct loss.',suggested_rewording:'Liability shall not exceed annual fees.'})});
 const explain=createExplanationService({generate});
 expect((await explain('clause',[],{risk_level:'safe'})).explanation).toBeNull();expect(generate).not.toHaveBeenCalled();
 const result=await explain('Uncapped liability.',[{id:12,text:'A capped clause',rationale:'Bounded',risk_level:'safe',similarity:0.4}],{risk_level:'caution',semantic_signal:'inconclusive',rule_flags:[]});
 expect(result.explanation).toContain('not legal advice');expect(generate.mock.calls[0][0]).toContain('baseline match is uncertain');expect(generate.mock.calls[0][0]).toContain('"id":12');
});
const suite=process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('pgvector retrieval',()=>{
 let db;
 beforeAll(()=>{db=createDatabase(process.env.TEST_DATABASE_URL);});afterAll(async()=>db.close());
 test('restricts category and returns cosine similarity',async()=>{
  const vector=Array(768).fill(0);vector[0]=1;
  const search=createSimilarityService(db);const rows=await search(vector,'Liability');
  expect(rows).toHaveLength(5);expect(rows.every(r=>r.category==='Liability')).toBe(true);expect(rows[0].similarity).toBeCloseTo(1);
  expect(await search(vector,'Other')).toHaveLength(5);
 });
});
