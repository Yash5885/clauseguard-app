const { loadConfig } = require('../src/config');
const { createDatabase } = require('../src/db');
const { migrate } = require('../src/db/migrate');
const { createGemini } = require('../src/services/gemini');
const { createEmbeddingService } = require('../src/services/embeddingService');
const data = require('../src/data/baselineClauses.json');
async function seed(db, embed, log = console.log) {
  const existing = new Set(
    (await db.query('SELECT category,text FROM baseline_clauses')).rows.map(
      (r) => `${r.category}\0${r.text}`,
    ),
  );
  const pending = data.filter((r) => !existing.has(`${r.category}\0${r.text}`));
  let inserted = 0;
  for (let offset = 0; offset < pending.length; offset += 16) {
    const batch = pending.slice(offset, offset + 16);
    const vectors = await embed(
      batch.map((r) => r.text),
      'RETRIEVAL_DOCUMENT',
    );
    await db.transaction(async (c) => {
      for (let i = 0; i < batch.length; i++) {
        const r = batch[i];
        const result = await c.query(
          'INSERT INTO baseline_clauses(category,text,risk_level,rationale,embedding) VALUES ($1,$2,$3,$4,$5::vector) ON CONFLICT (category,text) DO NOTHING',
          [r.category, r.text, r.risk_level, r.rationale, JSON.stringify(vectors[i])],
        );
        inserted += result.rowCount;
      }
    });
    log(`Seeded ${Math.min(offset + 16, pending.length)} of ${pending.length} pending clauses.`);
  }
  return inserted;
}
async function main() {
  const config = loadConfig();
  const db = createDatabase(config.DATABASE_URL);
  try {
    await migrate(db);
    await seed(db, createEmbeddingService(createGemini(config)));
  } finally {
    await db.close();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error('Seed failed:', e.message);
    process.exitCode = 1;
  });
module.exports = { seed };
