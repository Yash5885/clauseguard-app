const { createAnalysisPipeline } = require('../src/services/analysisPipeline');
const { categories } = require('../src/config/categories');
const { AppError } = require('../src/utils/errors');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function setup(explain, count = 4) {
  const updates = [], inserts = [];
  const db = {
    query: jest.fn(async (sql, args) => {
      if (sql.includes("status='processing' WHERE")) return { rowCount: 1 };
      if (sql.includes('FROM baseline_clauses'))
        return { rows: categories.map((category) => ({ category, n: 16 })) };
      if (sql.startsWith('UPDATE analyses SET progress=')) updates.push(JSON.parse(args[2]));
      if (sql.startsWith('INSERT INTO clauses')) inserts.push(args);
      return { rowCount: 1, rows: [{ id: 'report' }] };
    }),
  };
  db.transaction = jest.fn((fn) => fn(db));
  const pipeline = createAnalysisPipeline({
    db, explain, config: { GEMINI_CONCURRENCY: 2 }, logger: { error: jest.fn() },
    extract: async () => 'contract',
    segment: async () => ({ clauses: Array.from({ length: count }, (_, n) => ({ text: `Clause ${n}`, category: 'Liability' })), usedFallback: false }),
    embed: async () => Array.from({ length: count }, () => []), search: async () => [],
  });
  return { db, updates, inserts, run: () => pipeline({ id: 'report', user_id: 'owner', file_type: 'pdf' }, Buffer.from('file')) };
}
test('reviews two clauses concurrently, persists monotonic progress, and saves original order', async () => {
  const gates = Array.from({ length: 4 }, deferred);
  const explain = jest.fn((text) => gates[Number(text.at(-1))].promise);
  const fixture = setup(explain);
  const job = fixture.run();
  await tick();
  expect(explain).toHaveBeenCalledTimes(2);
  gates[1].resolve({ explanation: 'second' });
  await tick();
  expect(explain).toHaveBeenCalledTimes(3);
  gates[2].resolve({ explanation: 'third' });
  await tick();
  expect(explain).toHaveBeenCalledTimes(4);
  gates[0].resolve({ explanation: 'first' });
  gates[3].resolve({ explanation: 'fourth' });
  await job;
  expect(fixture.updates.filter((p) => p.stage === 'reviewing').map((p) => p.completed)).toEqual([0, 1, 2, 3, 4]);
  expect(fixture.updates.map((p) => p.stage)).toEqual(['extracting', 'segmenting', 'embedding', 'reviewing', 'reviewing', 'reviewing', 'reviewing', 'reviewing', 'saving']);
  expect(fixture.inserts.map((args) => args[1])).toEqual([0, 1, 2, 3]);
  expect(fixture.inserts.map((args) => args[8])).toEqual(['first', 'second', 'third', 'fourth']);
  for (const call of fixture.db.query.mock.calls.filter(([sql]) => sql.startsWith('UPDATE analyses SET progress=')))
    expect(call[1].slice(0, 2)).toEqual(['report', 'owner']);
});
test('stops scheduling after failure and drains in-flight work before marking failed', async () => {
  const first = deferred(), second = deferred();
  const explain = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const fixture = setup(explain);
  const job = fixture.run();
  await tick();
  first.reject(new AppError(503, 'GEMINI_DAILY_LIMIT', 'Daily limit reached'));
  await tick();
  expect(explain).toHaveBeenCalledTimes(2);
  expect(fixture.db.query.mock.calls.some(([sql]) => sql.includes("status='failed'"))).toBe(false);
  second.resolve({ explanation: 'finished' });
  await job;
  expect(explain).toHaveBeenCalledTimes(2);
  expect(fixture.inserts).toHaveLength(0);
  expect(fixture.db.transaction).not.toHaveBeenCalled();
  expect(fixture.db.query.mock.calls.at(-1)[0]).toContain("status='failed'");
});

test('uses bounded explanation batches instead of one request per flagged clause', async () => {
  const explain = jest.fn();
  explain.batch = jest.fn(async (items) => items.map(({ clause }) => ({ explanation: `Explanation for ${clause}`, suggested_rewording: 'Balanced terms' })));
  const fixture = setup(explain, 12);
  await fixture.run();
  expect(explain).not.toHaveBeenCalled();
  expect(explain.batch.mock.calls.map(([items]) => items.length)).toEqual([5, 5, 2]);
  expect(fixture.inserts.map((args) => args[8])).toEqual(Array.from({ length: 12 }, (_, n) => `Explanation for Clause ${n}`));
  expect(fixture.updates.filter((p) => p.stage === 'reviewing').map((p) => p.completed)).toEqual(Array.from({ length: 13 }, (_, n) => n));
});
