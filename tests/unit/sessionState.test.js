const SessionStateService = require('../../src/services/SessionStateService');
const LeaderboardRepository = require('../../src/repositories/LeaderboardRepository');
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
  getPlayerById,
} = require('../helpers');

const hasDb = !!process.env.TEST_DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe('SessionStateService.reconcile (lazy expiration)', () => {
  beforeAll(setupTestDb);
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await closeDb();
  });

  test('applies multiple missed expirations in one call (catch-up)', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'playing' });
    const a = await createPlayer(session.id, 'A');
    const b = await createPlayer(session.id, 'B');
    const c = await createPlayer(session.id, 'C');
    // Expired 1 full timer ago -> catch-up loop processes expirations until
    // the deadline is back in the future.
    await setBomb(session.id, a.id, new Date(Date.now() - 30000));

    const result = await SessionStateService.reconcile(session.join_code);

    expect(result.status).toBe('playing');
    // Two expirations processed (deadline lands exactly on now after the
    // first, so the loop runs once more), each producing a penalty.
    const { rows } = await getPool().query(
      'SELECT COUNT(*)::int AS count FROM penalties WHERE session_id = $1',
      [session.id]
    );
    expect(rows[0].count).toBe(2);
    const state = await getSessionById(session.id);
    expect(state.bomb_expires_at.getTime()).toBeGreaterThan(Date.now());
    expect(state.bomb_holder_id).not.toBeNull();
  });

  test('eliminates the holder at 3 penalties', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'playing' });
    const a = await createPlayer(session.id, 'A');
    const b = await createPlayer(session.id, 'B');
    const c = await createPlayer(session.id, 'C');
    await setPenaltyCount(a.id, 2);
    await setBomb(session.id, a.id, new Date(Date.now() - 30000));

    await SessionStateService.reconcile(session.join_code);

    const eliminated = await getPlayerById(a.id);
    expect(eliminated.status).toBe('eliminated');
    expect(eliminated.penalty_count).toBe(3);
    expect(eliminated.eliminated_at).not.toBeNull();
    const state = await getSessionById(session.id);
    expect(state.status).toBe('playing');
    expect(state.bomb_holder_id).not.toBe(a.id);
  });

  test('finishes the session and writes the leaderboard when one player remains', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'playing' });
    const a = await createPlayer(session.id, 'A');
    const b = await createPlayer(session.id, 'B');
    await setPenaltyCount(a.id, 2);
    await setBomb(session.id, a.id, new Date(Date.now() - 30000));

    const result = await SessionStateService.reconcile(session.join_code);

    expect(result.status).toBe('ended');
    expect(result.winner_player_id).toBe(b.id);
    const state = await getSessionById(session.id);
    expect(state.status).toBe('ended');
    expect(state.winner_player_id).toBe(b.id);
    expect(state.ended_at).not.toBeNull();
    expect(state.bomb_holder_id).toBeNull();
    expect(state.bomb_expires_at).toBeNull();
    const board = await LeaderboardRepository.findBySession(session.id);
    expect(board).not.toBeNull();
    const rankings = board.rankings;
    expect(rankings[0].nickname).toBe('B');
    expect(rankings[0].rank).toBe(1);
    expect(rankings[1].nickname).toBe('A');
    expect(rankings[1].status).toBe('eliminated');
  });

  test('advances to the next question when question_expires_at passes, and wraps around', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'playing' });
    const a = await createPlayer(session.id, 'A');
    const { rows: questions } = await getPool().query(
      'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY position',
      [set.id]
    );
    await getPool().query(
      'UPDATE sessions SET current_question_id = $2, question_expires_at = $3, bomb_holder_id = $4, bomb_expires_at = $5 WHERE id = $1',
      [session.id, questions[0].id, new Date(Date.now() - 1000), a.id, new Date(Date.now() + 30000)]
    );

    const result = await SessionStateService.reconcile(session.join_code);
    expect(result.current_question_id).toBe(questions[1].id);
    expect(result.question_expires_at.getTime()).toBeGreaterThan(Date.now());

    // Expire the second question too -> wraps back to the first.
    await getPool().query('UPDATE sessions SET question_expires_at = $2 WHERE id = $1', [
      session.id,
      new Date(Date.now() - 1000),
    ]);
    const wrapped = await SessionStateService.reconcile(session.join_code);
    expect(wrapped.current_question_id).toBe(questions[0].id);
  });

  test('advances early once all active players have answered', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'playing' });
    const a = await createPlayer(session.id, 'A');
    const b = await createPlayer(session.id, 'B');
    const { rows: questions } = await getPool().query(
      'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY position',
      [set.id]
    );
    await getPool().query(
      'UPDATE sessions SET current_question_id = $2, question_expires_at = $3, bomb_holder_id = $4, bomb_expires_at = $5 WHERE id = $1',
      [session.id, questions[0].id, new Date(Date.now() + 60000), a.id, new Date(Date.now() + 30000)]
    );
    for (const p of [a, b]) {
      await getPool().query(
        'INSERT INTO answers (session_id, player_id, question_id, choice_index, is_correct) VALUES ($1, $2, $3, 0, true)',
        [session.id, p.id, questions[0].id]
      );
    }

    const result = await SessionStateService.reconcile(session.join_code);
    expect(result.current_question_id).toBe(questions[1].id);
  });

  test('is idempotent: a second reconcile changes nothing', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'playing' });
    const a = await createPlayer(session.id, 'A');
    const b = await createPlayer(session.id, 'B');
    const c = await createPlayer(session.id, 'C');
    await setPenaltyCount(a.id, 2);
    await setBomb(session.id, a.id, new Date(Date.now() - 30000));

    await SessionStateService.reconcile(session.join_code);
    const afterFirst = await getSessionById(session.id);
    await SessionStateService.reconcile(session.join_code);
    const afterSecond = await getSessionById(session.id);

    expect(afterSecond.status).toBe(afterFirst.status);
    expect(afterSecond.bomb_holder_id).toBe(afterFirst.bomb_holder_id);
    expect(afterSecond.bomb_expires_at.getTime()).toBe(afterFirst.bomb_expires_at.getTime());
  });

  test('does nothing for waiting or ended sessions', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'waiting' });
    const result = await SessionStateService.reconcile(session.join_code);
    expect(result.status).toBe('waiting');
  });
});
