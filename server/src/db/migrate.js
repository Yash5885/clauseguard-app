const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
async function migrate(db) {
  await db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(81742391)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = new Set((await client.query('SELECT name FROM schema_migrations')).rows.map(r=>r.name));
    for (const name of (await readdir(path.join(__dirname,'migrations'))).filter(n=>n.endsWith('.sql')).sort()) {
      if (applied.has(name)) continue;
      await client.query(await readFile(path.join(__dirname,'migrations',name),'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES ($1)',[name]);
    }
  });
}
module.exports = { migrate };
