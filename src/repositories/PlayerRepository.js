const { getPool } = require('../db/pool');

class PlayerRepository {
  async findById(id, client) {
    const { rows } = await (client || getPool()).query('SELECT * FROM players WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findBySessionAndNickname(sessionId, nickname) {
    const { rows } = await getPool().query(
      'SELECT * FROM players WHERE session_id = $1 AND nickname = $2',
      [sessionId, nickname]
    );
    return rows[0] || null;
  }

  async countBySession(sessionId) {
    const { rows } = await getPool().query(
      'SELECT COUNT(*)::int AS count FROM players WHERE session_id = $1',
      [sessionId]
    );
    return rows[0].count;
  }

  async countActive(sessionId, client) {
    const { rows } = await (client || getPool()).query(
      "SELECT COUNT(*)::int AS count FROM players WHERE session_id = $1 AND status = 'active'",
      [sessionId]
    );
    return rows[0].count;
  }

  async listBySession(sessionId, client) {
    const { rows } = await (client || getPool()).query(
      'SELECT * FROM players WHERE session_id = $1 ORDER BY joined_at, id',
      [sessionId]
    );
    return rows;
  }

  async listActiveByIds(sessionId, client) {
    const { rows } = await (client || getPool()).query(
      "SELECT * FROM players WHERE session_id = $1 AND status = 'active' ORDER BY random()",
      [sessionId]
    );
    return rows;
  }

  async create({ session_id, nickname }) {
    const { rows } = await getPool().query(
      `INSERT INTO players (session_id, nickname) VALUES ($1, $2) RETURNING *`,
      [session_id, nickname]
    );
    return rows[0];
  }

  async addScore(id, points, client) {
    const { rows } = await (client || getPool()).query(
      'UPDATE players SET score = score + $2 WHERE id = $1 RETURNING *',
      [id, points]
    );
    return rows[0];
  }
}

module.exports = new PlayerRepository();
