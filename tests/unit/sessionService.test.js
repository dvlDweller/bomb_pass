const SessionService = require('../../src/services/SessionService');
const PlayerService = require('../../src/services/PlayerService');
const config = require('../../src/config');
const {
  setupTestDb,
  resetDb,
  closeDb,
  createHost,
  createQuestionSet,
  createSession,
  createPlayer,
} = require('../helpers');

const hasDb = !!process.env.TEST_DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe('SessionService join codes and PlayerService nicknames', () => {
  beforeAll(setupTestDb);
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await closeDb();
  });

  test('join codes are 6 digits and never start with 0', () => {
    for (let i = 0; i < 200; i++) {
      const code = SessionService.generateJoinCode();
      expect(code).toMatch(/^[1-9][0-9]{5}$/);
    }
  });

  test('join codes are unique among open sessions', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const codes = new Set();
    for (let i = 0; i < 10; i++) {
      const session = await SessionService.start(host.id, set.id);
      expect(session.status).toBe('waiting');
      expect(session.join_code).toMatch(/^[1-9][0-9]{5}$/);
      expect(codes.has(session.join_code)).toBe(false);
      codes.add(session.join_code);
    }
  });

  test('nickname must be 2-20 chars after trimming', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id);
    await expect(PlayerService.join(session.join_code, 'a')).rejects.toMatchObject({ status: 400 });
    await expect(PlayerService.join(session.join_code, '  ')).rejects.toMatchObject({ status: 400 });
    await expect(PlayerService.join(session.join_code, 'x'.repeat(21))).rejects.toMatchObject({ status: 400 });
    const ok = await PlayerService.join(session.join_code, '  Alice  ');
    expect(ok.nickname).toBe('Alice');
  });

  test('nickname bad-word filter rejects and never echoes the word', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id);
    const res = await PlayerService.join(session.join_code, 'shitface').catch((e) => e);
    expect(res.status).toBe(400);
    expect(res.code).toBe('VALIDATION_FAILED');
    expect(res.message).not.toContain('shit');
  });

  test('joining an ended session gets 409 SESSION_ENDED; playing gets SESSION_ALREADY_STARTED', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const waiting = await SessionService.start(host.id, set.id);
    await PlayerService.join(waiting.join_code, 'Ann');
    await PlayerService.join(waiting.join_code, 'Bob');

    const playing = await SessionService.start(host.id, set.id);
    await PlayerService.join(playing.join_code, 'Ann');
    await PlayerService.join(playing.join_code, 'Bob');
    await PlayerService.join(playing.join_code, 'Cara');
    await SessionService.updateStatus(playing.join_code, host.id, 'playing');
    await expect(PlayerService.join(playing.join_code, 'See')).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_ALREADY_STARTED',
    });

    await SessionService.updateStatus(playing.join_code, host.id, 'ended');
    await expect(PlayerService.join(playing.join_code, 'Kay')).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_ENDED',
    });
  });

  test('session full at MAX_PLAYERS gets 409 SESSION_FULL', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await SessionService.start(host.id, set.id);
    for (let i = 0; i < config.maxPlayers; i++) {
      await PlayerService.join(session.join_code, `P${i}`);
    }
    await expect(PlayerService.join(session.join_code, 'Late')).rejects.toMatchObject({
      status: 409,
      code: 'SESSION_FULL',
    });
  });
});
