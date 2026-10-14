const AnswerService = require('../../src/services/AnswerService');
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
} = require('../helpers');

const hasDb = !!process.env.TEST_DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

async function playingSession() {
  const host = await createHost();
  const set = await createQuestionSet(host.id);
  const session = await createSession(host.id, set.id, { status: 'playing' });
  const { rows: questions } = await getPool().query(
    'SELECT * FROM questions WHERE question_set_id = $1 ORDER BY position',
    [set.id]
  );
  await getPool().query(
    'UPDATE sessions SET current_question_id = $2, question_expires_at = $3 WHERE id = $1',
    [session.id, questions[0].id, new Date(Date.now() + 60000)]
  );
  const a = await createPlayer(session.id, 'A');
  const b = await createPlayer(session.id, 'B');
  const c = await createPlayer(session.id, 'C');
  await setBomb(session.id, a.id, new Date(Date.now() + 30000));
  await getPool().query("UPDATE players SET status = 'eliminated' WHERE id = $1", [c.id]);
  return { host, set, session, a, b, c, questions, q1: questions[0].id };
}

maybeDescribe('AnswerService', () => {
  beforeAll(setupTestDb);
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await closeDb();
  });

  test('correct answer returns correct:true, awards points, and rank', async () => {
    const { session, a, q1 } = await playingSession();
    // Question 1 correct_index is 1 (see helpers.createQuestionSet).
    const result = await AnswerService.submit(a, { question_id: q1, choice_index: 1 });
    expect(result.correct).toBe(true);
    expect(result.score).toBe(100);
    expect(result.rank).toBe(1);
  });

  test('wrong answer returns correct:false and awards no points', async () => {
    const { session, b, q1 } = await playingSession();
    const result = await AnswerService.submit(b, { question_id: q1, choice_index: 0 });
    expect(result.correct).toBe(false);
    expect(result.score).toBe(0);
  });

  test('second answer for the same question gets 409 ALREADY_ANSWERED', async () => {
    const { session, a, q1 } = await playingSession();
    await AnswerService.submit(a, { question_id: q1, choice_index: 1 });
    await expect(AnswerService.submit(a, { question_id: q1, choice_index: 2 })).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_ANSWERED',
    });
  });

  test('answering a question that is not active gets 409 NO_ACTIVE_QUESTION', async () => {
    const { session, a, questions } = await playingSession();
    await expect(
      AnswerService.submit(a, { question_id: questions[1].id, choice_index: 1 })
    ).rejects.toMatchObject({ status: 409, code: 'NO_ACTIVE_QUESTION' });
  });

  test('eliminated player gets 403 PLAYER_ELIMINATED', async () => {
    const { session, c, q1 } = await playingSession();
    await expect(AnswerService.submit(c, { question_id: q1, choice_index: 1 })).rejects.toMatchObject({
      status: 403,
      code: 'PLAYER_ELIMINATED',
    });
  });

  test('invalid choice_index gets 400 VALIDATION_FAILED', async () => {
    const { session, a, q1 } = await playingSession();
    await expect(AnswerService.submit(a, { question_id: q1, choice_index: 7 })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  test('question from another set gets 400 VALIDATION_FAILED', async () => {
    const { session, a } = await playingSession();
    const otherHost = await createHost('other');
    const otherSet = await createQuestionSet(otherHost.id);
    const { rows } = await getPool().query('SELECT * FROM questions WHERE question_set_id = $1', [
      otherSet.id,
    ]);
    await expect(AnswerService.submit(a, { question_id: rows[0].id, choice_index: 1 })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  test('current question response never leaks correct_index', async () => {
    const { session, a } = await playingSession();
    const result = await AnswerService.getCurrentQuestion(a, session.join_code);
    expect(result.text).toBeDefined();
    expect(result.type).toBe('multiple_choice');
    expect(result.choices).toHaveLength(4);
    expect(result.time_limit_sec).toBe(20);
    expect(result.points).toBe(100);
    expect(result.question_expires_at).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('correct_index');
  });

  test('current question gets 409 NO_ACTIVE_QUESTION when session is not playing', async () => {
    const host = await createHost();
    const set = await createQuestionSet(host.id);
    const session = await createSession(host.id, set.id, { status: 'waiting' });
    const a = await createPlayer(session.id, 'A');
    await expect(AnswerService.getCurrentQuestion(a, session.join_code)).rejects.toMatchObject({
      status: 409,
      code: 'NO_ACTIVE_QUESTION',
    });
  });
});
