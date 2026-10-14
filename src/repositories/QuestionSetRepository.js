const { getPool, withTransaction } = require('../db/pool');

class QuestionSetRepository {
  async create(set) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO question_sets (host_id, title, description, subject, grade_level)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [set.host_id, set.title, set.description, set.subject, set.grade_level]
      );
      const created = rows[0];
      for (const q of set.questions) {
        const qRes = await client.query(
          `INSERT INTO questions (question_set_id, position, text, type, correct_index, time_limit_sec, points)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [created.id, q.position, q.text, q.type, q.correct_index, q.time_limit_sec, q.points]
        );
        const question = qRes.rows[0];
        for (let i = 0; i < q.choices.length; i++) {
          await client.query(
            `INSERT INTO choices (question_id, choice_index, choice_text) VALUES ($1, $2, $3)`,
            [question.id, i, q.choices[i]]
          );
        }
      }
      return created;
    });
  }

  async findById(id) {
    const { rows } = await getPool().query('SELECT * FROM question_sets WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async listByHost(hostId) {
    const { rows } = await getPool().query(
      `SELECT qs.*, COUNT(q.id)::int AS question_count
       FROM question_sets qs
       LEFT JOIN questions q ON q.question_set_id = qs.id
       WHERE qs.host_id = $1
       GROUP BY qs.id
       ORDER BY qs.created_at DESC`,
      [hostId]
    );
    return rows;
  }

  async listQuestions(questionSetId) {
    const { rows } = await getPool().query(
      'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY position',
      [questionSetId]
    );
    return rows;
  }

  async findQuestionById(id, client) {
    const { rows } = await (client || getPool()).query('SELECT * FROM questions WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async listChoices(questionIds, client) {
    if (questionIds.length === 0) return [];
    const { rows } = await (client || getPool()).query(
      'SELECT * FROM choices WHERE question_id = ANY($1::int[]) ORDER BY question_id, choice_index',
      [questionIds]
    );
    return rows;
  }
}

module.exports = new QuestionSetRepository();
