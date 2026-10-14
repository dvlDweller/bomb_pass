const { getPool } = require('../db/pool');

class LeaderboardRepository {
  async upsert(sessionId, rankings, client) {
    const { rows } = await (client || getPool()).query(
      `INSERT INTO leaderboards (session_id, rankings, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (session_id) DO UPDATE SET rankings = EXCLUDED.rankings, updated_at = now()
       RETURNING *`,
      [sessionId, JSON.stringify(rankings)]
    );
    return rows[0];
  }

  async findBySession(sessionId) {
    const { rows } = await getPool().query(
      'SELECT * FROM leaderboards WHERE session_id = $1 ORDER BY updated_at DESC LIMIT 1',
      [sessionId]
    );
    return rows[0] || null;
  }
}

module.exports = new LeaderboardRepository();
