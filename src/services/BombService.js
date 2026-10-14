const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const { toIsoUtc } = require('../utils/dates');
const config = require('../config');
const { withTransaction } = require('../db/pool');
const SessionRepository = require('../repositories/SessionRepository');
const PlayerRepository = require('../repositories/PlayerRepository');
const SessionStateService = require('./SessionStateService');

class BombService {
  // Atomic via a session row lock: simultaneous passes serialize, the loser
  // re-reads the holder and gets 403 NOT_BOMB_HOLDER.
  async pass(player, code, targetPlayerId) {
    if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'target_player_id must be a positive whole number.');
    }

    return withTransaction(async (client) => {
      const session = await SessionRepository.lockByCode(client, code);
      if (!session || session.id !== player.session_id) {
        throw new AppError(404, errorCodes.SESSION_NOT_FOUND, 'That game no longer exists.');
      }

      // Reconcile first so an expired bomb has already moved to a new holder.
      await SessionStateService.reconcileSession(client, session);

      if (session.bomb_holder_id !== player.id) {
        throw new AppError(403, errorCodes.NOT_BOMB_HOLDER, 'Only the player holding the bomb can pass it.');
      }
      if (session.status === 'ended') {
        throw new AppError(409, errorCodes.SESSION_ENDED, 'This game has already ended.');
      }
      if (session.status !== 'playing') {
        throw new AppError(409, errorCodes.BOMB_EXPIRED, 'The game is not running right now.');
      }
      if (!session.bomb_expires_at || session.bomb_expires_at.getTime() <= Date.now()) {
        throw new AppError(409, errorCodes.BOMB_EXPIRED, 'The bomb has already exploded.');
      }

      const target = await PlayerRepository.findById(targetPlayerId, client);
      if (!target || target.session_id !== session.id) {
        throw new AppError(404, errorCodes.PLAYER_NOT_FOUND, 'That player is not in this game.');
      }
      if (target.status !== 'active') {
        throw new AppError(400, errorCodes.TARGET_ELIMINATED, 'That player has been eliminated.');
      }
      if (target.id === player.id) {
        throw new AppError(400, errorCodes.CANNOT_PASS_TO_SELF, 'You cannot pass the bomb to yourself.');
      }
      const activeCount = await PlayerRepository.countActive(session.id, client);
      if (activeCount < 2) {
        throw new AppError(409, errorCodes.NO_OTHER_ACTIVE_PLAYER, 'There is no other player to pass the bomb to.');
      }

      const deadline = new Date(Date.now() + config.bombTimerSeconds * 1000);
      await SessionRepository.updateGameStateClient(client, session.id, {
        bomb_holder_id: target.id,
        bomb_expires_at: deadline,
      });

      return {
        new_holder_id: target.id,
        new_holder_nickname: target.nickname,
        timer_reset: true,
        bomb_expires_at: toIsoUtc(deadline),
      };
    });
  }
}

module.exports = new BombService();
