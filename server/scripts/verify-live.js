const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { loadConfig } = require('../src/config');
const { createDatabase } = require('../src/db');
const { createGemini } = require('../src/services/gemini');
const { validateFile } = require('../src/services/fileValidator');
const { extractText } = require('../src/services/textExtractor');
const { createSegmenter } = require('../src/services/clauseSegmenter');
const { createEmbeddingService } = require('../src/services/embeddingService');
const { createSimilarityService } = require('../src/services/similarityService');
const { createExplanationService } = require('../src/services/explanationService');
const { runRules } = require('../src/services/ruleEngine');
const { scoreRisk } = require('../src/services/riskScorer');
const { categories } = require('../src/config/categories');

async function verifyLive({ db, gemini, config, file, log = console.log }) {
  const library = await db.query(
    'SELECT category, count(*)::int AS count, min(vector_norm(embedding)) AS min_norm, max(vector_norm(embedding)) AS max_norm FROM baseline_clauses GROUP BY category',
  );
  for (const category of categories) {
    const row = library.rows.find((item) => item.category === category);
    if (
      !row ||
      row.count < 16 ||
      Math.abs(row.min_norm - 1) > 0.001 ||
      Math.abs(row.max_norm - 1) > 0.001
    )
      throw new Error(
        'The reference library is missing or contains unnormalized embeddings. Run npm run seed against this database first.',
      );
  }
  log('Database and normalized reference library verified.');
  const type = await validateFile(file);
  const text = await extractText(file.buffer, type, config.MAX_TEXT_CHARACTERS);
  const segmented = await createSegmenter(gemini, undefined, config.MAX_CLAUSES)(text);
  if (segmented.usedFallback)
    throw new Error(
      'Document extraction succeeded, but Gemini segmentation used the fallback. Check model access and quota before deploying.',
    );
  log(`Gemini segmentation verified: ${segmented.clauses.length} clauses.`);
  const clause =
    segmented.clauses.find((item) => item.category === 'Liability') || segmented.clauses[0];
  const [embedding] = await createEmbeddingService(gemini)([clause.text]);
  const matches = await createSimilarityService(db)(embedding, clause.category);
  if (!matches.length) throw new Error('The reference search returned no matches.');
  const score = scoreRisk(matches, runRules(clause.category, clause.text), {
    unknownThreshold: config.UNKNOWN_THRESHOLD,
  });
  log('Gemini query embedding and pgvector retrieval verified.');
  if (score.risk_level !== 'safe') {
    await createExplanationService(gemini)(clause.text, matches, score);
    log('Grounded explanation and suggested wording verified.');
  } else {
    log('Selected clause is Safe; explanation generation was not required.');
  }
  log(
    'Live service check passed. No analysis records were created. Verify sign-in and a sample upload in the browser next.',
  );
}

async function main() {
  const config = loadConfig();
  const filePath =
    process.argv[2] || path.join(__dirname, '../../samples/one-sided-service-agreement.pdf');
  const file = { originalname: path.basename(filePath), buffer: await readFile(filePath) };
  const db = createDatabase(config.DATABASE_URL);
  try {
    await verifyLive({ db, gemini: createGemini(config), config, file });
  } finally {
    await db.close();
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(`Live service check failed: ${error.message}`);
    process.exitCode = 1;
  });
module.exports = { verifyLive };
