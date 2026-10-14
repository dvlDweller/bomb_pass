const { getPool } = require('../db/pool');

class AnswerRepository {
  async find(playerId, questionId, client) {
    const { rows } = await (client || getPool()).query(
      'SELECT * FROM answers WHERE player_id = $1 AND question_id = $2',
      [playerId, questionId]
    );
    return rows[0] || null;
  }

  async create({ session_id, player_id, question_id, choice_index, is_correct }, client) {
    const { rows } = await (client || getPool()).query(
      `INSERT INTO answers (session_id, player_id, question_id, choice_index, is_correct)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [session_id, player_id, question_id, choice_index, is_correct]
    );
    return rows[0];
  }

  async countBySession(sessionId) {
    const { rows } = await getPool().query(
      'SELECT COUNT(*)::int AS count FROM answers WHERE session_id = $1',
      [sessionId]
    );
    return rows[0].count;
  }
}

module.exports = new AnswerRepository();
