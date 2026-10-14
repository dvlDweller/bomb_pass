const { getPool } = require('../db/pool');

class PenaltyRepository {
  async create(client, { player_id, session_id, reason }) {
    const { rows } = await client.query(
      `INSERT INTO penalties (player_id, session_id, reason) VALUES ($1, $2, $3) RETURNING *`,
      [player_id, session_id, reason]
    );
    return rows[0];
  }

  async listBySession(sessionId) {
    const { rows } = await getPool().query(
      'SELECT * FROM penalties WHERE session_id = $1 ORDER BY created_at',
      [sessionId]
    );
    return rows;
  }
}

module.exports = new PenaltyRepository();
