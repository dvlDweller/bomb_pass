const jwt = require('jsonwebtoken');
const config = require('../config');

// Self-contained signed JWTs, verified per request (stateless, serverless-safe).
// Swapping the token technology means re-implementing sign/verify only.
// Host token: expiry env HOST_TOKEN_TTL (default 8h).
// Player token: expiry env PLAYER_TOKEN_TTL (default 3h), ONE session only,
// encodes player_id + session_id + role.
class AuthTokenService {
  signHost(host) {
    return jwt.sign({ role: 'host', host_id: host.id }, config.jwtSecret, {
      expiresIn: config.hostTokenTtl,
    });
  }

  signPlayer(player) {
    return jwt.sign(
      { role: 'player', player_id: player.id, session_id: player.session_id },
      config.jwtSecret,
      { expiresIn: config.playerTokenTtl }
    );
  }

  verify(token) {
    return jwt.verify(token, config.jwtSecret);
  }
}

module.exports = new AuthTokenService();
