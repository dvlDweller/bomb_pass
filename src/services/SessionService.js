const crypto = require('crypto');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const { toIsoUtc } = require('../utils/dates');
const config = require('../config');
const SessionRepository = require('../repositories/SessionRepository');
const PlayerRepository = require('../repositories/PlayerRepository');
const LeaderboardRepository = require('../repositories/LeaderboardRepository');
const QuestionSetService = require('./QuestionSetService');
const SessionStateService = require('./SessionStateService');
const QuestionFlowService = require('./QuestionFlowService');
const LeaderboardService = require('./LeaderboardService');

const MAX_CODE_ATTEMPTS = 10;

class SessionService {
  // Server-generated 6-digit join code, never starts with 0, unique among
  // OPEN sessions (retries on collision).
  generateJoinCode() {
    return String(100000 + crypto.randomInt(0, 900000));
  }

  async start(hostId, questionSetId) {
    if (!Number.isInteger(questionSetId) || questionSetId <= 0) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'question_set_id must be a positive whole number.');
    }
    // 404 if the set does not exist, 403 NOT_YOUR_QUESTION_SET if another host's.
    await QuestionSetService.getOwned(questionSetId, hostId);

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const joinCode = this.generateJoinCode();
      try {
        const session = await SessionRepository.create({
          host_id: hostId,
          question_set_id: questionSetId,
          join_code: joinCode,
        });
        return {
          id: session.id,
          join_code: session.join_code,
          status: session.status,
          question_set_id: session.question_set_id,
          created_at: toIsoUtc(session.created_at),
        };
      } catch (err) {
        if (err.code === '23505') continue; // join code collision — retry
        throw err;
      }
    }
    throw new AppError(500, errorCodes.SERVER_ERROR, 'Could not create a game. Please try again.');
  }

  async listForHost(hostId) {
    const sessions = await SessionRepository.listByHost(hostId);
    return sessions.map((s) => ({
      id: s.id,
      join_code: s.join_code,
      status: s.status,
      created_at: toIsoUtc(s.created_at),
      ended_at: s.ended_at ? toIsoUtc(s.ended_at) : null,
      winner_nickname: s.winner_nickname || null,
    }));
  }

  // Always reconciles first so the returned state is current.
  async getByCode(code) {
    const session = await SessionStateService.reconcile(code);
    if (!session) {
      throw new AppError(404, errorCodes.SESSION_NOT_FOUND, `No game uses the join code ${code}.`);
    }
    return this.toView(session);
  }

  async updateStatus(code, hostId, newStatus) {
    const session = await SessionStateService.reconcile(code);
    if (!session) {
      throw new AppError(404, errorCodes.SESSION_NOT_FOUND, `No game uses the join code ${code}.`);
    }
    if (session.host_id !== hostId) {
      throw new AppError(403, errorCodes.NOT_YOUR_SESSION, 'Only the host who created this game can change it.');
    }

    if (newStatus === 'playing') {
      if (session.status === 'ended') {
        throw new AppError(409, errorCodes.SESSION_ENDED, 'This game has already ended.');
      }
      if (session.status === 'playing') {
        throw new AppError(409, errorCodes.SESSION_ALREADY_STARTED, 'This game is already running.');
      }
      const activeCount = await PlayerRepository.countActive(session.id);
      if (activeCount < 3) {
        throw new AppError(409, errorCodes.NOT_ENOUGH_PLAYERS, 'At least 3 players are needed to start the game.');
      }
      const firstQuestion = await QuestionFlowService.firstQuestion(session.question_set_id);
      if (!firstQuestion) {
        throw new AppError(400, errorCodes.VALIDATION_FAILED, 'The question set has no questions.');
      }
      const active = await PlayerRepository.listActiveByIds(session.id);
      const firstHolder = active[0]; // random active player [ASSUMPTION]
      const now = Date.now();
      const questionExpiresAt = new Date(now + firstQuestion.time_limit_sec * 1000);
      await SessionRepository.updateGameState(session.id, {
        status: 'playing',
        started_at: new Date(now),
        bomb_holder_id: firstHolder.id,
        bomb_expires_at: new Date(now + config.bombTimerSeconds * 1000),
        current_question_id: firstQuestion.id,
        question_expires_at: questionExpiresAt,
      });
      session.status = 'playing';
      session.started_at = new Date(now);
      session.bomb_holder_id = firstHolder.id;
      session.bomb_expires_at = new Date(now + config.bombTimerSeconds * 1000);
      session.current_question_id = firstQuestion.id;
      session.question_expires_at = questionExpiresAt;
      return this.toView(session);
    }

    if (newStatus === 'ended') {
      if (session.status !== 'playing') {
        throw new AppError(
          409,
          session.status === 'ended' ? errorCodes.SESSION_ENDED : errorCodes.SESSION_ALREADY_STARTED,
          session.status === 'ended'
            ? 'This game has already ended.'
            : 'The game has not started yet, so there is nothing to end.'
        );
      }
      const players = await PlayerRepository.listBySession(session.id);
      const rankings = LeaderboardService.rankings(players);
      const winnerPlayer = LeaderboardService.sortPlayers(players)[0] || null;
      const now = new Date();
      await SessionRepository.updateGameState(session.id, {
        status: 'ended',
        ended_at: now,
        winner_player_id: winnerPlayer ? winnerPlayer.id : null,
        bomb_holder_id: null,
        bomb_expires_at: null,
      });
      await LeaderboardRepository.upsert(session.id, rankings);
      session.status = 'ended';
      session.ended_at = now;
      session.winner_player_id = winnerPlayer ? winnerPlayer.id : null;
      session.bomb_holder_id = null;
      session.bomb_expires_at = null;
      return this.toView(session);
    }

    throw new AppError(400, errorCodes.VALIDATION_FAILED, 'status must be "playing" or "ended".');
  }

  // Host review: session metadata + final rankings. Host-only.
  async getResults(code, hostId) {
    const session = await SessionStateService.reconcile(code);
    if (!session) {
      throw new AppError(404, errorCodes.SESSION_NOT_FOUND, `No game uses the join code ${code}.`);
    }
    if (session.host_id !== hostId) {
      throw new AppError(403, errorCodes.NOT_YOUR_SESSION, 'Only the host who created this game can view its results.');
    }
    const players = await PlayerRepository.listBySession(session.id);
    const rankings = LeaderboardService.rankings(players);
    const winner = session.winner_player_id
      ? await PlayerRepository.findById(session.winner_player_id)
      : null;
    return {
      id: session.id,
      join_code: session.join_code,
      status: session.status,
      player_count: players.length,
      started_at: session.started_at ? toIsoUtc(session.started_at) : null,
      ended_at: session.ended_at ? toIsoUtc(session.ended_at) : null,
      winner_nickname: winner ? winner.nickname : null,
      rankings,
    };
  }

  async toView(session) {
    const [players, holder, winner] = await Promise.all([
      PlayerRepository.listBySession(session.id),
      session.bomb_holder_id ? PlayerRepository.findById(session.bomb_holder_id) : null,
      session.winner_player_id ? PlayerRepository.findById(session.winner_player_id) : null,
    ]);
    return {
      id: session.id,
      join_code: session.join_code,
      status: session.status,
      player_count: players.length,
      bomb_holder_id: session.bomb_holder_id,
      bomb_holder_nickname: holder ? holder.nickname : null,
      bomb_expires_at: session.bomb_expires_at ? toIsoUtc(session.bomb_expires_at) : null,
      question_expires_at: session.question_expires_at ? toIsoUtc(session.question_expires_at) : null,
      server_time: toIsoUtc(new Date()),
      winner_nickname: winner ? winner.nickname : null,
    };
  }
}

module.exports = new SessionService();
