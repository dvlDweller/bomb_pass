const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const { withTransaction } = require('../db/pool');
const SessionRepository = require('../repositories/SessionRepository');
const PlayerRepository = require('../repositories/PlayerRepository');
const AnswerRepository = require('../repositories/AnswerRepository');
const QuestionSetRepository = require('../repositories/QuestionSetRepository');
const SessionStateService = require('./SessionStateService');
const LeaderboardService = require('./LeaderboardService');

class AnswerService {
  // Players send a CHOICE; the server decides correctness. correct_index is
  // never stored in the response — only the boolean.
  async submit(player, { question_id, choice_index }) {
    if (!Number.isInteger(question_id) || question_id <= 0) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'question_id must be a positive whole number.');
    }
    if (!Number.isInteger(choice_index) || choice_index < 0 || choice_index > 3) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'choice_index must be a whole number between 0 and 3.');
    }

    return withTransaction(async (client) => {
      // Re-load the player inside the transaction: never trust caller state.
      const freshPlayer = await PlayerRepository.findById(player.id, client);
      if (!freshPlayer) throw new AppError(404, errorCodes.PLAYER_NOT_FOUND, 'That player no longer exists.');

      const { rows } = await client.query('SELECT * FROM sessions WHERE id = $1 FOR UPDATE', [
        freshPlayer.session_id,
      ]);
      const session = rows[0];
      if (!session) throw new AppError(404, errorCodes.SESSION_NOT_FOUND, 'That game no longer exists.');

      await SessionStateService.reconcileSession(client, session);

      if (session.status === 'ended') {
        throw new AppError(409, errorCodes.SESSION_ENDED, 'This game has already ended.');
      }
      if (session.status !== 'playing') {
        throw new AppError(409, errorCodes.NO_ACTIVE_QUESTION, 'The game is not running right now.');
      }
      if (freshPlayer.status !== 'active') {
        throw new AppError(403, errorCodes.PLAYER_ELIMINATED, 'Eliminated players cannot answer questions.');
      }

      const question = await QuestionSetRepository.findQuestionById(question_id, client);
      if (!question || question.question_set_id !== session.question_set_id) {
        throw new AppError(400, errorCodes.VALIDATION_FAILED, 'question_id does not belong to this game.');
      }
      if (session.current_question_id !== question_id) {
        throw new AppError(409, errorCodes.NO_ACTIVE_QUESTION, 'That question is no longer active.');
      }

      const existing = await AnswerRepository.find(freshPlayer.id, question_id, client);
      if (existing) {
        throw new AppError(409, errorCodes.ALREADY_ANSWERED, 'You have already answered this question.');
      }

      const choices = await QuestionSetRepository.listChoices([question_id], client);
      const isCorrect = question.correct_index === choice_index;

      await AnswerRepository.create(
        {
          session_id: session.id,
          player_id: freshPlayer.id,
          question_id,
          choice_index,
          is_correct: isCorrect,
        },
        client
      );

      let score = freshPlayer.score;
      if (isCorrect) {
        const updated = await PlayerRepository.addScore(freshPlayer.id, question.points, client);
        score = updated.score;
      }

      const players = await PlayerRepository.listBySession(session.id, client);
      const rankings = LeaderboardService.rankings(players);
      const rank = rankings.find((r) => r.nickname === freshPlayer.nickname)?.rank ?? rankings.length;

      return { correct: isCorrect, score, rank };
    });
  }

  // Current question for players: NEVER includes correct_index.
  async getCurrentQuestion(player, code) {
    const session = await SessionRepository.findByCode(code);
    if (!session || session.id !== player.session_id) {
      throw new AppError(404, errorCodes.SESSION_NOT_FOUND, 'That game no longer exists.');
    }
    if (session.status !== 'playing' || !session.current_question_id) {
      throw new AppError(409, errorCodes.NO_ACTIVE_QUESTION, 'There is no active question right now.');
    }
    const question = await QuestionSetRepository.findQuestionById(session.current_question_id);
    if (!question) {
      throw new AppError(409, errorCodes.NO_ACTIVE_QUESTION, 'There is no active question right now.');
    }
    const choices = await QuestionSetRepository.listChoices([question.id]);
    return {
      question_id: question.id,
      text: question.text,
      type: question.type,
      choices: choices.map((c) => ({
        choice_index: c.choice_index,
        choice_text: c.choice_text,
      })),
      time_limit_sec: question.time_limit_sec,
      question_expires_at: session.question_expires_at
        ? session.question_expires_at.toISOString().replace(/\.\d{3}Z$/, 'Z')
        : null,
      points: question.points,
    };
  }
}

module.exports = new AnswerService();
