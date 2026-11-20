const { verifyLive } = require('../scripts/verify-live');
const { categories } = require('../src/config/categories');
const fs = require('node:fs');
const path = require('node:path');

const library = () =>
  categories.map((category) => ({ category, count: 16, min_norm: 1, max_norm: 1 }));
test.each(['missing', 'incomplete', 'unnormalized'])(
  'live verification rejects %s reference data before sending contract text',
  async (kind) => {
    const rows = library();
    if (kind === 'missing') rows.pop();
    if (kind === 'incomplete') rows[0].count = 15;
    if (kind === 'unnormalized') rows[0].min_norm = 0.5;
    const gemini = { generate: jest.fn(), embed: jest.fn() };
    await expect(
      verifyLive({
        db: { query: async () => ({ rows }) },
        gemini,
        config: {},
        file: {},
        log: jest.fn(),
      }),
    ).rejects.toThrow('reference library');
    expect(gemini.generate).not.toHaveBeenCalled();
    expect(gemini.embed).not.toHaveBeenCalled();
  },
);

test('live check exercises extraction, segmentation, embedding, retrieval and explanation without report writes', async () => {
  const db = {
    query: jest.fn(async (sql) => ({
      rows: sql.includes('GROUP BY category')
        ? library()
        : [
            {
              id: 1,
              text: 'Liability shall be unlimited.',
              rationale: 'Unbounded exposure.',
              risk_level: 'risky',
              similarity: 0.9,
            },
          ],
    })),
  };
  const vector = Array(768).fill(0);
  vector[0] = 1;
  const gemini = {
    embed: jest.fn(async (texts) => ({ embeddings: texts.map(() => ({ values: vector })) })),
    generate: jest.fn(async (prompt) => ({
      text: JSON.stringify(
        prompt.startsWith('Split all')
          ? {
              clauses: [
                {
                  text: prompt.split('<contract>\n')[1].split('\n</contract>')[0],
                  category: 'Liability',
                },
              ],
            }
          : {
              explanation:
                'The supplied baseline carries unlimited exposure. Consider a defined cap. Informational only; not legal advice.',
              suggested_rewording: 'Each party liability shall be limited to annual fees.',
            },
      ),
    })),
  };
  await verifyLive({
    db,
    gemini,
    config: { UNKNOWN_THRESHOLD: 0.6, MAX_CLAUSES: 300, MAX_TEXT_CHARACTERS: 250000 },
    file: {
      originalname: 'contract.docx',
      buffer: fs.readFileSync(path.join(__dirname, 'fixtures/contract.docx')),
    },
    log: jest.fn(),
  });
  expect(gemini.generate).toHaveBeenCalledTimes(2);
  expect(gemini.embed).toHaveBeenCalledWith(expect.any(Array), 'RETRIEVAL_QUERY');
  expect(db.query.mock.calls.every(([sql]) => sql.startsWith('SELECT'))).toBe(true);
});
