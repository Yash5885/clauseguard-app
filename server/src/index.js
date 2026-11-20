const { loadConfig } = require('./config');
const pino = require('pino');
const { createApp } = require('./app');
const { createDatabase } = require('./db');
const { migrate } = require('./db/migrate');
const { createAuth } = require('./middleware/auth');
const { createAnalysisRouter } = require('./routes/analyses');
const { createAnalysisRepository } = require('./services/analysisRepository');
const { createAnalysisPipeline, recoverAnalyses } = require('./services/analysisPipeline');
const { createJobQueue } = require('./services/jobQueue');
const { createGemini } = require('./services/gemini');
const { createEmbeddingService } = require('./services/embeddingService');
const { createSegmenter } = require('./services/clauseSegmenter');
const { createSimilarityService } = require('./services/similarityService');
const { createExplanationService } = require('./services/explanationService');
const { extractText } = require('./services/textExtractor');
const { createWorkerLifecycle, requireWorkerReady } = require('./services/workerLifecycle');
async function main() {
  const config = loadConfig();
  const logger = pino({
    level: config.LOG_LEVEL,
    redact: ['req.headers.authorization', 'GEMINI_API_KEY', 'CLERK_SECRET_KEY', 'DATABASE_URL'],
  });
  const db = createDatabase(config.DATABASE_URL);
  db.pool.on('error', (err) => logger.error({ err }, 'Idle database connection failed'));
  try {
    await migrate(db);
    const gemini = createGemini(config);
    const queue = createJobQueue({
      concurrency: config.QUEUE_CONCURRENCY,
      capacity: config.QUEUE_CAPACITY,
      logger,
    });
    const worker = createWorkerLifecycle({
      db,
      queue,
      logger,
      recover: recoverAnalyses,
      onLeaseLost: () => process.exit(1),
    });
    const pipeline = createAnalysisPipeline({
      db,
      extract: extractText,
      segment: createSegmenter(gemini, logger, config.MAX_CLAUSES),
      embed: createEmbeddingService(gemini),
      search: createSimilarityService(db),
      explain: createExplanationService(gemini),
      config,
      logger,
    });
    const router = createAnalysisRouter({
      repository: createAnalysisRepository(db, config),
      queue,
      pipeline,
    });
    const app = createApp({
      config,
      logger,
      auth: [...createAuth(config), requireWorkerReady(worker)],
      router,
    });
    const server = await new Promise((resolve, reject) => {
      const http = app.listen(config.PORT, () => resolve(http));
      http.once('error', reject);
    });
    logger.info({ port: config.PORT }, 'API listening');
    void worker.start();
    let shuttingDown = false;
    for (const signal of ['SIGTERM', 'SIGINT'])
      process.once(signal, () => {
        if (shuttingDown) return;
        shuttingDown = true;
        setTimeout(() => process.exit(1), 55000).unref();
        worker.shutdown(server).then(
          () => process.exit(0),
          (err) => {
            logger.error({ err }, 'Shutdown failed');
            process.exit(1);
          },
        );
      });
  } catch (error) {
    await db.close();
    throw error;
  }
}
main().catch((error) => {
  console.error(`API startup failed: ${error.message}`);
  process.exitCode = 1;
});
