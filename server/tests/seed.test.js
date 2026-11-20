const {seed}=require('../scripts/seed');
const {createDatabase}=require('../src/db');
const {migrate}=require('../src/db/migrate');
const data=require('../src/data/baselineClauses.json');
const suite=process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('seed persistence',()=>{
 let db;
 beforeAll(async()=>{db=createDatabase(process.env.TEST_DATABASE_URL);await migrate(db);});
 afterAll(async()=>{await db.close();});
 test('a repeat seed skips existing clauses before making embedding calls',async()=>{
  const vector=Array(768).fill(0);vector[0]=1;
  const embed=jest.fn(async texts=>texts.map(()=>vector));
  await seed(db,embed,()=>{});embed.mockClear();
  expect(await seed(db,embed,()=>{})).toBe(0);expect(embed).not.toHaveBeenCalled();
  expect((await db.query('SELECT count(*)::int AS n FROM baseline_clauses WHERE text=ANY($1)',[data.map(r=>r.text)])).rows[0].n).toBe(128);
 });
});
