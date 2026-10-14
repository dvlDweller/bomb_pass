const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const AuthTokenService = require('../services/AuthTokenService');
const PlayerRepository = require('../repositories/PlayerRepository');

function extractToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

// Verifies a host JWT (role "host"). Player tokens are rejected with 403
// WRONG_TOKEN_TYPE; missing/invalid/expired tokens with 401 AUTH_REQUIRED.
async function requireHost(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError(401, errorCodes.AUTH_REQUIRED, 'Please log in first.');
    const payload = AuthTokenService.verify(token);
    if (payload.role !== 'host') {
      throw new AppError(403, errorCodes.WRONG_TOKEN_TYPE, 'A host token is required here.');
    }
    // NOTE: req.host is a reserved Express getter (hostname) — never assign to it.
    req.hostUser = { id: payload.host_id };
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError(401, errorCodes.AUTH_REQUIRED, 'Your session has expired. Please log in again.'));
  }
}

// Verifies a player JWT (role "player") and loads the fresh player row.
async function requirePlayer(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError(401, errorCodes.AUTH_REQUIRED, 'Please join the game first.');
    const payload = AuthTokenService.verify(token);
    if (payload.role !== 'player') {
      throw new AppError(403, errorCodes.WRONG_TOKEN_TYPE, 'A player token is required here.');
    }
    const player = await PlayerRepository.findById(payload.player_id);
    if (!player) throw new AppError(401, errorCodes.AUTH_REQUIRED, 'Your player account no longer exists.');
    req.playerUser = player;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError(401, errorCodes.AUTH_REQUIRED, 'Your session has expired. Please join again.'));
  }
}

module.exports = { requireHost, requirePlayer };
