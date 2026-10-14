const QuestionSetRepository = require('../repositories/QuestionSetRepository');
const PlayerRepository = require('../repositories/PlayerRepository');
const AnswerRepository = require('../repositories/AnswerRepository');

// Question advancement [ASSUMPTION: a question is active until
// question_expires_at (= question start + time_limit_sec), or until all active
// players have answered; then advance to the next question, wrapping around].
class QuestionFlowService {
  // First question of the set (used when a session starts).
  async firstQuestion(questionSetId) {
    const questions = await QuestionSetRepository.listQuestions(questionSetId);
    if (questions.length === 0) return null;
    return questions[0];
  }

  // True when every active player has answered the current question.
  async allActiveAnswered(client, session) {
    if (!session.current_question_id) return false;
    const active = await PlayerRepository.countActive(session.id, client);
    if (active === 0) return false;
    const { rows } = await client.query(
      `SELECT COUNT(DISTINCT a.player_id)::int AS count
       FROM answers a
       JOIN players p ON p.id = a.player_id
       WHERE a.question_id = $1 AND p.status = 'active'`,
      [session.current_question_id]
    );
    return rows[0].count >= active;
  }

  // Advance to the next question (wrap around) and open a fresh answer window.
  async advance(client, session, now) {
    const questions = await QuestionSetRepository.listQuestions(session.question_set_id);
    if (questions.length === 0) return;
    const currentIndex = session.current_question_id
      ? questions.findIndex((q) => q.id === session.current_question_id)
      : -1;
    const next = questions[(currentIndex + 1) % questions.length];
    const expiresAt = new Date(now + next.time_limit_sec * 1000);
    await client.query(
      'UPDATE sessions SET current_question_id = $2, question_expires_at = $3 WHERE id = $1',
      [session.id, next.id, expiresAt]
    );
    session.current_question_id = next.id;
    session.question_expires_at = expiresAt;
  }
}

module.exports = new QuestionFlowService();
