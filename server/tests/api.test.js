const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createApp } = require('../src/app');
const { AppError } = require('../src/utils/errors');
const { createDatabase } = require('../src/db');
const { migrate } = require('../src/db/migrate');
const { seed } = require('../scripts/seed');
const { createAnalysisRepository } = require('../src/services/analysisRepository');
const { createAnalysisRouter } = require('../src/routes/analyses');
const { createJobQueue } = require('../src/services/jobQueue');
const { createAnalysisPipeline, recoverAnalyses } = require('../src/services/analysisPipeline');
const { createSegmenter } = require('../src/services/clauseSegmenter');
const { createEmbeddingService } = require('../src/services/embeddingService');
const { createSimilarityService } = require('../src/services/similarityService');
const { createExplanationService } = require('../src/services/explanationService');
const { extractText } = require('../src/services/textExtractor');
const logger = { error: jest.fn(), warn: jest.fn() };
const auth = (req, res, next) => {
  const user = req.headers['x-test-user'];
  if (!user) return next(new AppError(401, 'UNAUTHORIZED', 'Sign in to access your contracts.'));
  req.userId = user;
  next();
};
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('authenticated analysis API with PostgreSQL and mocked Gemini', () => {
  let db, app, queue, repository, config, pipeline, user, gemini;
  const buffer = fs.readFileSync(path.join(__dirname, 'fixtures', 'contract.docx'));
  const vector = Array(768).fill(0);
  vector[0] = 1;
  beforeAll(async () => {
    db = createDatabase(process.env.TEST_DATABASE_URL);
    await migrate(db);
    await seed(
      db,
      async (texts) => texts.map(() => vector),
      () => {},
    );
  });
  beforeEach(() => {
    user = `api-test-${randomUUID()}`;
    config = {
      CLIENT_URL: 'http://localhost:3000',
      USER_CONCURRENCY: 2,
      DAILY_ANALYSIS_LIMIT: 10,
      UNKNOWN_THRESHOLD: 0.6,
      MAX_TEXT_CHARACTERS: 250000,
    };
    gemini = {
      embed: jest.fn(async (texts) => ({ embeddings: texts.map(() => ({ values: vector })) })),
      generate: jest.fn(async (prompt) => {
        if (prompt.startsWith('Split all')) {
          const text = prompt.split('<contract>\n')[1].split('\n</contract>')[0];
          const at = text.indexOf('2. Liability');
          return {
            text: JSON.stringify({
              clauses: [
                { text: text.slice(0, at).trim(), category: 'Payment Terms' },
                { text: text.slice(at).trim(), category: 'Liability' },
              ],
            }),
          };
        }
        return {
          text: JSON.stringify({
            explanation:
              'The supplied reference uses a more balanced allocation. Review the scope before signing. This is informational and not legal advice.',
            suggested_rewording: 'Each party liability is capped at annual fees.',
          }),
        };
      }),
    };
    repository = createAnalysisRepository(db, config);
    queue = createJobQueue({ concurrency: 1, capacity: 5, logger });
    pipeline = createAnalysisPipeline({
      db,
      config,
      logger,
      extract: extractText,
      segment: createSegmenter(gemini),
      embed: createEmbeddingService(gemini),
      search: createSimilarityService(db),
      explain: createExplanationService(gemini),
    });
    app = createApp({
      config,
      logger,
      auth,
      router: createAnalysisRouter({ repository, queue, pipeline }),
    });
  });
  afterEach(async () => {
    await queue.drain();
    await db.query('DELETE FROM analyses WHERE user_id=$1 OR user_id=$2', [user, `${user}-other`]);
    await db.query('DELETE FROM daily_analysis_usage WHERE user_id=$1', [user]);
  });
  afterAll(async () => db.close());
  const upload = () =>
    request(app)
      .post('/api/analyses')
      .set('x-test-user', user)
      .attach('file', buffer, 'contract.docx');
  test('requires authentication before upload processing', async () => {
    expect((await request(app).get('/api/analyses')).status).toBe(401);
    expect((await request(app).post('/api/analyses')).status).toBe(401);
  });
  test('validates upload and pagination errors', async () => {
    expect((await request(app).post('/api/analyses').set('x-test-user', user)).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/analyses')
          .set('x-test-user', user)
          .attach('file', Buffer.from('text'), 'bad.pdf')
      ).status,
    ).toBe(400);
    expect((await request(app).get('/api/analyses?page=-1').set('x-test-user', user)).status).toBe(
      400,
    );
  });
  test('accepts immediately, processes a real document and persists a complete ordered report', async () => {
    const accepted = await upload();
    expect(accepted.status).toBe(202);
    expect(accepted.body.status).toBe('pending');
    await queue.drain();
    const result = await request(app)
      .get(`/api/analyses/${accepted.body.id}`)
      .set('x-test-user', user);
    expect(result.body.status).toBe('completed');
    expect(result.body.clauses).toHaveLength(2);
    expect(result.body.clauses.map((c) => c.position)).toEqual([0, 1]);
    expect(result.body.summary.total).toBe(2);
    expect(gemini.embed).toHaveBeenCalled();
    const history = await request(app).get('/api/analyses?limit=1').set('x-test-user', user);
    expect(history.body.total).toBe(1);
    expect(
      (await request(app).delete(`/api/analyses/${accepted.body.id}`).set('x-test-user', user))
        .status,
    ).toBe(204);
    expect(
      (await db.query('SELECT id FROM clauses WHERE analysis_id=$1', [accepted.body.id])).rowCount,
    ).toBe(0);
  });
  test('isolates read, list and delete by owner', async () => {
    const accepted = await upload();
    await queue.drain();
    const other = `${user}-other`;
    for (const method of ['get', 'delete'])
      expect(
        (await request(app)[method](`/api/analyses/${accepted.body.id}`).set('x-test-user', other))
          .status,
      ).toBe(404);
    expect(
      (await request(app).get('/api/analyses').set('x-test-user', other)).body.analyses,
    ).toHaveLength(0);
  });
  test('daily cap survives deletion and is safe against parallel requests', async () => {
    const limited = createAnalysisRepository(db, { ...config, DAILY_ANALYSIS_LIMIT: 1 });
    const results = await Promise.allSettled([
      limited.create(user, 'a.pdf', 'pdf'),
      limited.create(user, 'b.pdf', 'pdf'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = results.find((r) => r.status === 'fulfilled').value;
    await db.query("UPDATE analyses SET status='failed' WHERE id=$1 AND user_id=$2", [
      row.id,
      user,
    ]);
    await limited.remove(user, row.id);
    await expect(limited.create(user, 'c.pdf', 'pdf')).rejects.toMatchObject({
      code: 'DAILY_LIMIT',
    });
  });
  test('enforces per-user concurrent cap and blocks deletion of active analyses', async () => {
    const limited = createAnalysisRepository(db, { ...config, USER_CONCURRENCY: 1 });
    const row = await limited.create(user, 'a.pdf', 'pdf');
    await expect(limited.create(user, 'b.pdf', 'pdf')).rejects.toMatchObject({
      code: 'CONCURRENT_LIMIT',
    });
    await expect(limited.remove(user, row.id)).rejects.toMatchObject({ code: 'ANALYSIS_ACTIVE' });
  });
  test('rolls back every clause when report insertion fails', async () => {
    const realSearch = createSimilarityService(db);
    let n = 0;
    const failing = createAnalysisPipeline({
      db,
      config,
      logger,
      extract: extractText,
      segment: createSegmenter(gemini),
      embed: createEmbeddingService(gemini),
      explain: createExplanationService(gemini),
      search: async (...args) => {
        const rows = await realSearch(...args);
        return ++n === 2 ? rows.map((r) => ({ ...r, id: '999999999999' })) : rows;
      },
    });
    const row = await repository.create(user, 'a.docx', 'docx');
    await failing(row, buffer);
    const result = await repository.get(user, row.id);
    expect(result.status).toBe('failed');
    expect(result.clauses).toHaveLength(0);
    expect(result.error_message).not.toContain('foreign key');
  });
  test('startup recovery clears pending and processing analyses', async () => {
    const row = await repository.create(user, 'a.pdf', 'pdf');
    await recoverAnalyses(db);
    expect((await repository.get(user, row.id)).status).toBe('failed');
  });
});
test('queue bounds memory and limits concurrency', async () => {
  const queue = createJobQueue({ concurrency: 1, capacity: 1, logger });
  let finish;
  const reservation = queue.reserve();
  expect(() => queue.reserve()).toThrow('queue is full');
  reservation.submit(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await new Promise((resolve) => setImmediate(resolve));
  finish();
  await queue.drain();
  const second = queue.reserve();
  second.release();
  await queue.drain();
  queue.stop();
  expect(() => queue.reserve()).toThrow();
});
