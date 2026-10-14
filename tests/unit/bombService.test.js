const BombService = require('../../src/services/BombService');
const { getPool } = require('../../src/db/pool');
const {
  setupTestDb,
  resetDb,
  closeDb,
  createHost,
  createQuestionSet,
  createSession,
  createPlayer,
  setBomb,
  setPenaltyCount,
  getSessionById,
} = require('../helpers');

const hasDb = !!process.env.TEST_DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

async function playingSession() {
  const host = await createHost();
  const set = await createQuestionSet(host.id);
  const session = await createSession(host.id, set.id, { status: 'playing' });
  const a = await createPlayer(session.id, 'A');
  const b = await createPlayer(session.id, 'B');
  const c = await createPlayer(session.id, 'C');
  await setBomb(session.id, a.id, new Date(Date.now() + 30000));
  return { session, a, b, c };
}

maybeDescribe('BombService.pass', () => {
  beforeAll(setupTestDb);
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await closeDb();
  });

  test('current holder can pass to another active player and the timer resets', async () => {
    const { session, a, b } = await playingSession();
    const result = await BombService.pass(a, session.join_code, b.id);
    expect(result.new_holder_id).toBe(b.id);
    expect(result.new_holder_nickname).toBe('B');
    expect(result.timer_reset).toBe(true);
    expect(result.bomb_expires_at).toBeDefined();
    const state = await getSessionById(session.id);
    expect(state.bomb_holder_id).toBe(b.id);
    expect(state.bomb_expires_at.getTime()).toBeGreaterThan(Date.now() + 20000);
  });

  test('non-holder gets 403 NOT_BOMB_HOLDER', async () => {
    const { session, a, b } = await playingSession();
    await expect(BombService.pass(b, session.join_code, a.id)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_BOMB_HOLDER',
    });
  });

  test('unknown target gets 404 PLAYER_NOT_FOUND', async () => {
    const { session, a } = await playingSession();
    await expect(BombService.pass(a, session.join_code, 999999)).rejects.toMatchObject({
      status: 404,
      code: 'PLAYER_NOT_FOUND',
    });
  });

  test('eliminated target gets 400 TARGET_ELIMINATED', async () => {
    const { session, a, b } = await playingSession();
    await getPool().query("UPDATE players SET status = 'eliminated' WHERE id = $1", [b.id]);
    await expect(BombService.pass(a, session.join_code, b.id)).rejects.toMatchObject({
      status: 400,
      code: 'TARGET_ELIMINATED',
    });
  });

  test('passing to yourself gets 400 CANNOT_PASS_TO_SELF', async () => {
    const { session, a } = await playingSession();
    await expect(BombService.pass(a, session.join_code, a.id)).rejects.toMatchObject({
      status: 400,
      code: 'CANNOT_PASS_TO_SELF',
    });
  });

  test('invalid target id gets 400 VALIDATION_FAILED', async () => {
    const { session, a } = await playingSession();
    await expect(BombService.pass(a, session.join_code, -1)).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  test('passing when the deadline already passed gets 403 after reconcile', async () => {
    const { session, a, b } = await playingSession();
    // Force the deadline into the past with the holder at 2 penalties:
    // reconcile eliminates the holder, so the bomb definitely moves.
    await setPenaltyCount(a.id, 2);
    await setBomb(session.id, a.id, new Date(Date.now() - 1000));
    await expect(BombService.pass(a, session.join_code, b.id)).rejects.toMatchObject({
      status: 403,
      code: 'NOT_BOMB_HOLDER',
    });
  });

  test('concurrent passes: exactly one wins, the other gets 403', async () => {
    const { session, a, b, c } = await playingSession();
    const results = await Promise.allSettled([
      BombService.pass(a, session.join_code, b.id),
      BombService.pass(a, session.join_code, c.id),
    ]);
    const statuses = results.map((r) => (r.status === 'fulfilled' ? 200 : r.reason.status));
    expect(statuses).toContain(200);
    expect(statuses).toContain(403);
    const state = await getSessionById(session.id);
    expect([b.id, c.id]).toContain(state.bomb_holder_id);
  });
});
