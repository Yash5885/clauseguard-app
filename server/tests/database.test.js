const { createDatabase } = require('../src/db');
const { migrate } = require('../src/db/migrate');
const suite = process.env.TEST_DATABASE_URL ? describe : describe.skip;
suite('PostgreSQL migrations and transactions', () => {
  let db;
  beforeAll(async () => {
    db = createDatabase(process.env.TEST_DATABASE_URL);
    await migrate(db);
  });
  afterAll(async () => {
    await db.close();
  });
  test('migration is idempotent and pgvector has expected dimensions', async () => {
    await migrate(db);
    expect(
      (await db.query("SELECT extname FROM pg_extension WHERE extname='vector'")).rowCount,
    ).toBe(1);
    expect(
      (
        await db.query(
          "SELECT format_type(atttypid,atttypmod) AS type FROM pg_attribute WHERE attrelid='baseline_clauses'::regclass AND attname='embedding'",
        )
      ).rows[0].type,
    ).toBe('vector(768)');
  });
  test('rolls back a failed transaction', async () => {
    let id;
    await expect(
      db.transaction(async (c) => {
        id = (
          await c.query(
            "INSERT INTO analyses(user_id,file_name,file_type) VALUES ('rollback-test','test.pdf','pdf') RETURNING id",
          )
        ).rows[0].id;
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');
    expect((await db.query('SELECT id FROM analyses WHERE id=$1', [id])).rowCount).toBe(0);
  });
});
