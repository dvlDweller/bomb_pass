const request = require('supertest');
const createApp = require('../../src/app');
const { getPool } = require('../../src/db/pool');
const { setupTestDb, resetDb, closeDb, createHost, createQuestionSet, createSession, createPlayer, setBomb } = require('../helpers');

const hasDb = !!process.env.TEST_DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

const app = createApp();

const rule3Set = {
  title: 'Exportable Set',
  subject: 'Science',
  questions: [
    {
      text: 'H2O is?',
      type: 'multiple_choice',
      choices: ['Water', 'Oxygen', 'Hydrogen', 'Salt'],
      correct_index: 0,
      time_limit_sec: 15,
    },
  ],
};

async function login(request, app, username = 'librarian', password = 'secret123') {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ username, password });
  return res.body.token;
}

maybeDescribe('Host tools: export, import, copy, results, forfeit', () => {
  let hostToken;
  let setId;
  let host;

  beforeAll(setupTestDb);
  beforeEach(async () => {
    await resetDb();
    host = await createHost('librarian', 'secret123');
    hostToken = await login(request, app);
    const setRes = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${hostToken}`)
      .send(rule3Set);
    setId = setRes.body.id;
  });
  afterAll(async () => {
    await resetDb();
    await closeDb();
  });

  test('export returns the Rule 3 set with correct_index and a file header', async () => {
    const res = await request(app)
      .get(`/api/v1/question-sets/${setId}/export`)
      .set('Authorization', `Bearer ${hostToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.title).toBe('Exportable Set');
    expect(res.body.questions[0].correct_index).toBe(0);
    expect(res.body.questions[0].choices).toEqual(['Water', 'Oxygen', 'Hydrogen', 'Salt']);
  });

  test('export is host-only (403 for another host, 401 without token)', async () => {
    await createHost('intruder', 'secret123');
    const other = await login(request, app, 'intruder', 'secret123');
    const res = await request(app)
      .get(`/api/v1/question-sets/${setId}/export`)
      .set('Authorization', `Bearer ${other}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NOT_YOUR_QUESTION_SET');

    const noAuth = await request(app).get(`/api/v1/question-sets/${setId}/export`);
    expect(noAuth.status).toBe(401);
  });

  test('import creates a new set from a Rule 3 body', async () => {
    const res = await request(app)
      .post('/api/v1/question-sets/import')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ ...rule3Set, title: 'Imported Set' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Imported Set');
    expect(res.body.id).not.toBe(setId);
    expect(res.body.question_count).toBe(1);
  });

  test('import validates like create (400 on bad body)', async () => {
    const res = await request(app)
      .post('/api/v1/question-sets/import')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'bad', questions: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  test('copy duplicates the set with " (copy)" in the title', async () => {
    const res = await request(app)
      .post(`/api/v1/question-sets/${setId}/copy`)
      .set('Authorization', `Bearer ${hostToken}`);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Exportable Set (copy)');
    expect(res.body.id).not.toBe(setId);
    expect(res.body.question_count).toBe(1);
    expect(res.body.questions[0].correct_index).toBe(0);

    // The copy is independent: the original still exists.
    const list = await request(app)
      .get('/api/v1/question-sets')
      .set('Authorization', `Bearer ${hostToken}`);
    expect(list.body).toHaveLength(2);
  });

  test('copy is host-only (404 for a set the host does not own)', async () => {
    await createHost('intruder', 'secret123');
    const other = await login(request, app, 'intruder', 'secret123');
    const res = await request(app)
      .post(`/api/v1/question-sets/${setId}/copy`)
      .set('Authorization', `Bearer ${other}`);
    expect(res.status).toBe(403);
  });

  test('results returns session metadata + rankings for the owning host', async () => {
    const hostId = host.id;
    const set = await createQuestionSet(hostId);
    const session = await createSession(hostId, set.id, { status: 'ended' });
    const a = await createPlayer(session.id, 'Ann', { score: 100 });
    const b = await createPlayer(session.id, 'Bob', { score: 200 });
    await getPool().query('UPDATE sessions SET winner_player_id = $2 WHERE id = $1', [session.id, b.id]);

    const res = await request(app)
      .get(`/api/v1/sessions/${session.join_code}/results`)
      .set('Authorization', `Bearer ${hostToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ended');
    expect(res.body.winner_nickname).toBe('Bob');
    expect(res.body.rankings).toHaveLength(2);
    expect(res.body.rankings[0].nickname).toBe('Bob');
    expect(res.body.rankings[0].rank).toBe(1);
    expect(res.body.rankings[1].nickname).toBe('Ann');
    void a;
  });

  test('results is host-only (403 for another host, 401 without token)', async () => {
    const hostId = host.id;
    const set = await createQuestionSet(hostId);
    const session = await createSession(hostId, set.id, { status: 'waiting' });

    await createHost('intruder', 'secret123');
    const other = await login(request, app, 'intruder', 'secret123');
    const forbidden = await request(app)
      .get(`/api/v1/sessions/${session.join_code}/results`)
      .set('Authorization', `Bearer ${other}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('NOT_YOUR_SESSION');

    const noAuth = await request(app).get(`/api/v1/sessions/${session.join_code}/results`);
    expect(noAuth.status).toBe(401);
  });

  test('forfeit marks the player eliminated and keeps them in results', async () => {
    const hostId = host.id;
    const set = await createQuestionSet(hostId);
    const session = await createSession(hostId, set.id, { status: 'waiting' });
    const joinA = await request(app)
      .post(`/api/v1/sessions/${session.join_code}/players`)
      .send({ nickname: 'Ann' });
    const joinB = await request(app)
      .post(`/api/v1/sessions/${session.join_code}/players`)
      .send({ nickname: 'Bob' });

    const res = await request(app)
      .delete(`/api/v1/sessions/${session.join_code}/players/${joinA.body.id}`)
      .set('Authorization', `Bearer ${joinA.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('eliminated');

    const players = await request(app).get(`/api/v1/sessions/${session.join_code}/players`);
    const ann = players.body.find((p) => p.nickname === 'Ann');
    expect(ann.status).toBe('eliminated');
    void joinB;
  });

  test('forfeit requires the player to target themselves (403 otherwise)', async () => {
    const hostId = host.id;
    const set = await createQuestionSet(hostId);
    const session = await createSession(hostId, set.id, { status: 'waiting' });
    const joinA = await request(app)
      .post(`/api/v1/sessions/${session.join_code}/players`)
      .send({ nickname: 'Ann' });
    const joinB = await request(app)
      .post(`/api/v1/sessions/${session.join_code}/players`)
      .send({ nickname: 'Bob' });

    const res = await request(app)
      .delete(`/api/v1/sessions/${session.join_code}/players/${joinB.body.id}`)
      .set('Authorization', `Bearer ${joinA.body.token}`);
    expect(res.status).toBe(403);
  });

  test('forfeit ends the game when one active player remains', async () => {
    const hostId = host.id;
    const set = await createQuestionSet(hostId);
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ question_set_id: set.id });
    const joinA = await request(app)
      .post(`/api/v1/sessions/${sessionRes.body.join_code}/players`)
      .send({ nickname: 'Ann' });
    const joinB = await request(app)
      .post(`/api/v1/sessions/${sessionRes.body.join_code}/players`)
      .send({ nickname: 'Bob' });
    const joinC = await request(app)
      .post(`/api/v1/sessions/${sessionRes.body.join_code}/players`)
      .send({ nickname: 'Cara' });
    await request(app)
      .patch(`/api/v1/sessions/${sessionRes.body.join_code}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'playing' });

    // Two players forfeit → one active player remains → that player wins.
    await request(app)
      .delete(`/api/v1/sessions/${sessionRes.body.join_code}/players/${joinA.body.id}`)
      .set('Authorization', `Bearer ${joinA.body.token}`);
    const forfeitB = await request(app)
      .delete(`/api/v1/sessions/${sessionRes.body.join_code}/players/${joinB.body.id}`)
      .set('Authorization', `Bearer ${joinB.body.token}`);
    expect(forfeitB.status).toBe(200);

    const view = await request(app).get(`/api/v1/sessions/${sessionRes.body.join_code}`);
    expect(view.body.status).toBe('ended');
    expect(view.body.winner_nickname).toBe('Cara');
    void joinC;
  });

  test('forfeit on an ended session gets 409 SESSION_ENDED', async () => {
    const hostId = host.id;
    const set = await createQuestionSet(hostId);
    const session = await createSession(hostId, set.id, { status: 'waiting' });
    const joinA = await request(app)
      .post(`/api/v1/sessions/${session.join_code}/players`)
      .send({ nickname: 'Ann' });
    await request(app)
      .post(`/api/v1/sessions/${session.join_code}/players`)
      .send({ nickname: 'Bob' });
    await request(app)
      .post(`/api/v1/sessions/${session.join_code}/players`)
      .send({ nickname: 'Cara' });
    await request(app)
      .patch(`/api/v1/sessions/${session.join_code}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'playing' });
    await request(app)
      .patch(`/api/v1/sessions/${session.join_code}`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ status: 'ended' });

    const res = await request(app)
      .delete(`/api/v1/sessions/${session.join_code}/players/${joinA.body.id}`)
      .set('Authorization', `Bearer ${joinA.body.token}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SESSION_ENDED');
  });
});

