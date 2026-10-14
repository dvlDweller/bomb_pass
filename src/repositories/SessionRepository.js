const { getPool } = require('../db/pool');

class SessionRepository {
  async findById(id) {
    const { rows } = await getPool().query('SELECT * FROM sessions WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async findByCode(code) {
    const { rows } = await getPool().query('SELECT * FROM sessions WHERE join_code = $1', [code]);
    return rows[0] || null;
  }

  async lockByCode(client, code) {
    const { rows } = await client.query('SELECT * FROM sessions WHERE join_code = $1 FOR UPDATE', [code]);
    return rows[0] || null;
  }

  async create({ host_id, question_set_id, join_code }) {
    const { rows } = await getPool().query(
      `INSERT INTO sessions (host_id, question_set_id, join_code) VALUES ($1, $2, $3) RETURNING *`,
      [host_id, question_set_id, join_code]
    );
    return rows[0];
  }

  async listByHost(hostId) {
    const { rows } = await getPool().query(
      `SELECT s.*, p.nickname AS winner_nickname
       FROM sessions s
       LEFT JOIN players p ON p.id = s.winner_player_id
       WHERE s.host_id = $1
       ORDER BY s.created_at DESC`,
      [hostId]
    );
    return rows;
  }

  async updateGameState(id, fields) {
    const sets = [];
    const values = [id];
    let i = 2;
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = $${i++}`);
      values.push(value);
    }
    const { rows } = await getPool().query(
      `UPDATE sessions SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return rows[0];
  }

  async updateGameStateClient(client, id, fields) {
    const sets = [];
    const values = [id];
    let i = 2;
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = $${i++}`);
      values.push(value);
    }
    const { rows } = await client.query(
      `UPDATE sessions SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );
    return rows[0];
  }
}

module.exports = new SessionRepository();
