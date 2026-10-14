const crypto = require('crypto');
const bcrypt = require('bcrypt');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const config = require('../config');
const AuthRepository = require('../repositories/AuthRepository');
const AuthTokenService = require('./AuthTokenService');

class AuthService {
  // Rate limiting is database-backed (login_attempts table), never in-memory.
  // Only a SHA-256 hash of the IP is stored, never the IP itself.
  async login(username, password, ip) {
    if (!username || !password) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'Username and password are required.');
    }
    const ipHash = ip ? crypto.createHash('sha256').update(String(ip)).digest('hex') : null;
    const failures = await AuthRepository.countRecentFailures(username, config.loginWindowMinutes);
    if (failures >= config.loginMaxAttempts) {
      throw new AppError(
        401,
        errorCodes.INVALID_CREDENTIALS,
        'Too many failed attempts. Please try again later.'
      );
    }
    const host = await AuthRepository.findByUsername(username);
    const ok = host && (await bcrypt.compare(password, host.password_hash));
    if (!ok) {
      await AuthRepository.recordFailure(username, ipHash);
      throw new AppError(401, errorCodes.INVALID_CREDENTIALS, 'Invalid username or password.');
    }
    await AuthRepository.clearFailures(username);
    const token = AuthTokenService.signHost(host);
    return { token, host_id: host.id, username: host.username };
  }
}

module.exports = new AuthService();
