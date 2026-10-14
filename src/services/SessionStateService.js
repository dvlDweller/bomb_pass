const config = require('../config');
const { withTransaction } = require('../db/pool');
const ApiError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const SessionRepository = require('../repositories/SessionRepository');
const PlayerRepository = require('../repositories/PlayerRepository');
const PenaltyRepository = require('../repositories/PenaltyRepository');
const QuestionFlowService = require('./QuestionFlowService');
const LeaderboardService = require('./LeaderboardService');

const MAX_PENALTIES = 3;

// Server-authoritative lazy expiration. Every request that reads or changes a
// session calls reconcile() first. No timers anywhere: clients poll, and the
// bomb expires on the next request after the deadline.
class SessionStateService {
  // Public entry point: locks the session row, then reconciles.
  async reconcile(code) {
    return withTransaction(async (client) => {
      const session = await SessionRepository.lockByCode(client, code);
      if (!session) return null;
      return this.reconcileSession(client, session);
    });
  }

  // Core loop. MUST run inside a transaction that holds the session row lock.
  // Idempotent and safe under concurrent calls: the second caller blocks on
  // FOR UPDATE, then sees the already-updated state.
  async reconcileSession(client, session) {
    if (session.status !== 'playing') return session;
    const now = Date.now();

    // 1) Bomb expiration loop.
    let guard = 0;
    while (
      session.status === 'playing' &&
      session.bomb_expires_at !== null &&
      session.bomb_expires_at !== undefined &&
      session.bomb_expires_at.getTime() <= now
    ) {
      if (++guard > 10000) break; // safety valve, never expected to trigger

      if (session.bomb_holder_id === null) {
        // Defensive: a playing session always has a holder, but never crash
        // if one is missing — just reassign and continue.
        await this.reassignHolder(client, session, new Date(now + config.bombTimerSeconds * 1000));
        continue;
      }

      const holderId = session.bomb_holder_id;
      await PenaltyRepository.create(client, {
        player_id: holderId,
        session_id: session.id,
        reason: 'bomb_expiration',
      });
      const { rows } = await client.query(
        'UPDATE players SET penalty_count = penalty_count + 1 WHERE id = $1 RETURNING *',
        [holderId]
      );
      const holder = rows[0];
      if (holder.penalty_count >= MAX_PENALTIES) {
        await client.query(
          "UPDATE players SET status = 'eliminated', eliminated_at = now() WHERE id = $1",
          [holderId]
        );
      }

      const active = await PlayerRepository.listActiveByIds(session.id, client);
      if (active.length <= 1) {
        const winnerId = active.length === 1 ? active[0].id : null;
        await SessionRepository.updateGameStateClient(client, session.id, {
          status: 'ended',
          winner_player_id: winnerId,
          ended_at: new Date(now),
          bomb_holder_id: null,
          bomb_expires_at: null,
        });
        session.status = 'ended';
        session.winner_player_id = winnerId;
        session.ended_at = new Date(now);
        session.bomb_holder_id = null;
        session.bomb_expires_at = null;
        const players = await PlayerRepository.listBySession(session.id, client);
        await LeaderboardService.writeFinal(client, session.id, players);
        return session;
      }

      // Catch-up: next deadline = PREVIOUS deadline + timer (not now + timer),
      // so multiple missed expirations are processed correctly.
      const nextDeadline = new Date(
        session.bomb_expires_at.getTime() + config.bombTimerSeconds * 1000
      );
      await this.reassignHolder(client, session, nextDeadline);
    }

    // 2) Question advancement: active until question_expires_at, or until all
    // active players have answered. Wraps around to the first question.
    if (session.status === 'playing' && session.current_question_id !== null) {
      let qGuard = 0;
      while (
        session.status === 'playing' &&
        session.current_question_id !== null &&
        qGuard++ < 10000
      ) {
        const expired =
          session.question_expires_at !== null &&
          session.question_expires_at !== undefined &&
          session.question_expires_at.getTime() <= now;
        const allAnswered = await QuestionFlowService.allActiveAnswered(client, session);
        if (!expired && !allAnswered) break;
        await QuestionFlowService.advance(client, session, Date.now());
      }
    }

    return session;
  }

  // A player leaves the game: mark them eliminated, then settle the session
  // (reassign the bomb if they held it; end the game if one player remains).
  async forfeitPlayer(client, session, playerId) {
    const target = await PlayerRepository.findById(playerId, client);
    if (!target || target.session_id !== session.id) {
      throw new ApiError(404, errorCodes.PLAYER_NOT_FOUND, 'That player is not in this game.');
    }
    if (target.status === 'eliminated') {
      return { id: playerId, status: 'eliminated' }; // idempotent
    }
    await client.query(
      "UPDATE players SET status = 'eliminated', eliminated_at = now() WHERE id = $1",
      [playerId]
    );
    target.status = 'eliminated';

    if (session.status === 'playing') {
      const active = await PlayerRepository.listActiveByIds(session.id, client);
      if (active.length <= 1) {
        const winnerId = active.length === 1 ? active[0].id : null;
        const now = new Date();
        await SessionRepository.updateGameStateClient(client, session.id, {
          status: 'ended',
          winner_player_id: winnerId,
          ended_at: now,
          bomb_holder_id: null,
          bomb_expires_at: null,
        });
        session.status = 'ended';
        session.winner_player_id = winnerId;
        session.ended_at = now;
        session.bomb_holder_id = null;
        session.bomb_expires_at = null;
        const players = await PlayerRepository.listBySession(session.id, client);
        await LeaderboardService.writeFinal(client, session.id, players);
      } else if (session.bomb_holder_id === playerId) {
        const deadline = new Date(Date.now() + config.bombTimerSeconds * 1000);
        await this.reassignHolder(client, session, deadline);
      }
    }
    return { id: playerId, status: 'eliminated' };
  }

  // Assigns the bomb to a random active player [ASSUMPTION] and sets the deadline.
  async reassignHolder(client, session, deadline) {
    const active = await PlayerRepository.listActiveByIds(session.id, client);
    if (active.length === 0) return;
    const nextHolder = active[0]; // listActiveByIds uses ORDER BY random()
    await SessionRepository.updateGameStateClient(client, session.id, {
      bomb_holder_id: nextHolder.id,
      bomb_expires_at: deadline,
    });
    session.bomb_holder_id = nextHolder.id;
    session.bomb_expires_at = deadline;
  }
}

module.exports = new SessionStateService();
