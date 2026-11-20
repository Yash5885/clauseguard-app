const { AppError } = require('../utils/errors');
function createAnalysisRepository(db, config) {
  return {
    async create(userId, fileName, fileType) {
      return db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [userId]);
        const active = (
          await client.query(
            "SELECT count(*)::int AS n FROM analyses WHERE user_id=$1 AND status IN ('pending','processing')",
            [userId],
          )
        ).rows[0].n;
        if (active >= config.USER_CONCURRENCY)
          throw new AppError(
            429,
            'CONCURRENT_LIMIT',
            'You already have the maximum number of analyses running.',
          );
        const usage =
          (
            await client.query(
              "SELECT analyses_started FROM daily_analysis_usage WHERE user_id=$1 AND usage_date=(now() AT TIME ZONE 'UTC')::date",
              [userId],
            )
          ).rows[0]?.analyses_started || 0;
        if (usage >= config.DAILY_ANALYSIS_LIMIT)
          throw new AppError(
            429,
            'DAILY_LIMIT',
            'You have reached your daily analysis limit. Try again after midnight UTC.',
          );
        await client.query(
          "INSERT INTO daily_analysis_usage(user_id,usage_date,analyses_started) VALUES($1,(now() AT TIME ZONE 'UTC')::date,1) ON CONFLICT (user_id,usage_date) DO UPDATE SET analyses_started=daily_analysis_usage.analyses_started+1",
          [userId],
        );
        return (
          await client.query(
            'INSERT INTO analyses(user_id,file_name,file_type) VALUES($1,$2,$3) RETURNING *',
            [userId, fileName, fileType],
          )
        ).rows[0];
      });
    },
    async list(userId, page, limit) {
      const [records, total] = await Promise.all([
        db.query(
          'SELECT * FROM analyses WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',
          [userId, limit, (page - 1) * limit],
        ),
        db.query('SELECT count(*)::int AS n FROM analyses WHERE user_id=$1', [userId]),
      ]);
      return { analyses: records.rows, page, limit, total: total.rows[0].n };
    },
    async get(userId, id) {
      return db.transaction(async (client) => {
        const row = (
          await client.query('SELECT * FROM analyses WHERE id=$1 AND user_id=$2 FOR SHARE', [
            id,
            userId,
          ])
        ).rows[0];
        if (!row) throw new AppError(404, 'NOT_FOUND', 'Analysis not found.');
        const clauses = await client.query(
          'SELECT c.* FROM clauses c JOIN analyses a ON a.id=c.analysis_id WHERE a.id=$1 AND a.user_id=$2 ORDER BY c.position',
          [id, userId],
        );
        return { ...row, clauses: clauses.rows };
      });
    },
    async remove(userId, id) {
      return db.transaction(async (client) => {
        const row = (
          await client.query('SELECT status FROM analyses WHERE id=$1 AND user_id=$2 FOR UPDATE', [
            id,
            userId,
          ])
        ).rows[0];
        if (!row) throw new AppError(404, 'NOT_FOUND', 'Analysis not found.');
        if (['pending', 'processing'].includes(row.status))
          throw new AppError(
            409,
            'ANALYSIS_ACTIVE',
            'Wait for this analysis to finish before deleting it.',
          );
        await client.query('DELETE FROM analyses WHERE id=$1 AND user_id=$2', [id, userId]);
      });
    },
  };
}
module.exports = { createAnalysisRepository };
