const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const { toIsoUtc } = require('../utils/dates');
const config = require('../config');
const { withTransaction } = require('../db/pool');
const SessionRepository = require('../repositories/SessionRepository');
const PlayerRepository = require('../repositories/PlayerRepository');
const AuthTokenService = require('./AuthTokenService');
const SessionStateService = require('./SessionStateService');

const CODE_PATTERN = /^\d{6}$/;

function containsBadWord(nickname) {
  const lower = nickname.toLowerCase();
  return config.badWords.some((word) => lower.includes(word.toLowerCase()));
}

class PlayerService {
  // Players need no account: nickname + 6-digit code only. No real name,
  // student ID, email, phone, or photo is collected.
  // The player token is issued at join: 3h, valid for ONE session only.
  async join(code, nickname) {
    if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'The join code must be exactly 6 digits.');
    }
    const trimmed = typeof nickname === 'string' ? nickname.trim() : '';
    if (trimmed.length < 2 || trimmed.length > 20) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'Nickname must be 2-20 characters.');
    }
    if (containsBadWord(trimmed)) {
      // Generic message: never echo the offending word.
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'That nickname is not allowed. Please pick another.');
    }

    const session = await SessionRepository.findByCode(code);
    if (!session) {
      throw new AppError(404, errorCodes.SESSION_NOT_FOUND, `No game uses the join code ${code}.`);
    }
    if (session.status === 'ended') {
      throw new AppError(409, errorCodes.SESSION_ENDED, 'This game has already ended.');
    }
    if (session.status === 'playing') {
      throw new AppError(
        409,
        errorCodes.SESSION_ALREADY_STARTED,
        'This game has already started and cannot accept new players.'
      );
    }

    const playerCount = await PlayerRepository.countBySession(session.id);
    if (playerCount >= config.maxPlayers) {
      throw new AppError(409, errorCodes.SESSION_FULL, 'This game is full.');
    }

    try {
      const player = await PlayerRepository.create({ session_id: session.id, nickname: trimmed });
      const token = AuthTokenService.signPlayer(player);
      return {
        id: player.id,
        nickname: player.nickname,
        score: player.score,
        penalty_count: player.penalty_count,
        status: player.status,
        joined_at: toIsoUtc(player.joined_at),
        token,
      };
    } catch (err) {
      if (err.code === '23505') {
        throw new AppError(409, errorCodes.NICKNAME_TAKEN, 'That nickname is already taken in this game.');
      }
      throw err;
    }
  }

  // A player leaves the game. The player is marked eliminated (kept in the
  // record for results); the bomb is reassigned if they held it, and the game
  // ends if one active player remains.
  async forfeit(code, playerId) {
    return withTransaction(async (client) => {
      const session = await SessionRepository.lockByCode(client, code);
      if (!session) {
        throw new AppError(404, errorCodes.SESSION_NOT_FOUND, `No game uses the join code ${code}.`);
      }
      // Reconcile first to settle any pending expirations.
      await SessionStateService.reconcileSession(client, session);
      if (session.status === 'ended') {
        throw new AppError(409, errorCodes.SESSION_ENDED, 'This game has already ended.');
      }
      return SessionStateService.forfeitPlayer(client, session, playerId);
    });
  }

  async listByCode(code) {
    const session = await SessionRepository.findByCode(code);
    if (!session) {
      throw new AppError(404, errorCodes.SESSION_NOT_FOUND, `No game uses the join code ${code}.`);
    }
    const players = await PlayerRepository.listBySession(session.id);
    return players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      score: p.score,
      penalty_count: p.penalty_count,
      status: p.status,
    }));
  }
}

module.exports = new PlayerService();
