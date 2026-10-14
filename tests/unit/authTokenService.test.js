const AuthTokenService = require('../../src/services/AuthTokenService');

describe('AuthTokenService', () => {
  test('signs and verifies a host token', () => {
    const token = AuthTokenService.signHost({ id: 42 });
    const payload = AuthTokenService.verify(token);
    expect(payload.role).toBe('host');
    expect(payload.host_id).toBe(42);
  });

  test('signs and verifies a player token with session_id', () => {
    const token = AuthTokenService.signPlayer({ id: 7, session_id: 9 });
    const payload = AuthTokenService.verify(token);
    expect(payload.role).toBe('player');
    expect(payload.player_id).toBe(7);
    expect(payload.session_id).toBe(9);
  });

  test('rejects a tampered token', () => {
    const token = AuthTokenService.signHost({ id: 1 });
    expect(() => AuthTokenService.verify(token + 'x')).toThrow();
  });

  test('rejects a token signed with a different secret', () => {
    const jwt = require('jsonwebtoken');
    const forged = jwt.sign({ type: 'host', host_id: 1 }, 'wrong-secret');
    expect(() => AuthTokenService.verify(forged)).toThrow();
  });
});
