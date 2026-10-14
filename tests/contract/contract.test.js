const request = require('supertest');
const createApp = require('../../src/app');
const { setupTestDb, resetDb, closeDb, createHost } = require('../helpers');

const hasDb = !!process.env.TEST_DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

const app = createApp();

const rule3Set = {
  title: 'Contract Test Set',
  questions: [
    {
      text: 'Is the sky blue?',
      type: 'true_false',
      choices: ['True', 'False'],
      correct_index: 0,
    },
  ],
};

maybeDescribe('Hub Contract v1 — Week 17 contract check', () => {
  beforeAll(setupTestDb);
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await closeDb();
  });

  test('Rule 1: game-info has every field with valid types', async () => {
    const res = await request(app).get('/api/v1/game-info');
    expect(res.status).toBe(200);
    const body = res.body;
    expect(typeof body.slug).toBe('string');
    expect(body.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(typeof body.name).toBe('string');
    expect(body.name.length).toBeLessThanOrEqual(40);
    expect(typeof body.team).toBe('string');
    expect(body.team).toContain('BSCS');
    expect(typeof body.description).toBe('string');
    expect(body.description.length).toBeLessThanOrEqual(150);
    expect(body.description.trim().endsWith('.')).toBe(true);
    expect(Number.isInteger(body.min_players)).toBe(true);
    expect(Number.isInteger(body.max_players)).toBe(true);
    expect(body.min_players).toBeGreaterThanOrEqual(1);
    expect(typeof body.thumbnail_url).toBe('string');
    expect(body.thumbnail_url).toBe('/games/bomb-pass/thumbnail.png');
    expect(typeof body.play_url).toBe('string');
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('Rule 1: thumbnail is served as a PNG', async () => {
    const res = await request(app).get('/games/bomb-pass/thumbnail.png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    // PNG magic bytes.
    expect(res.body.slice(0, 4).toString('hex')).toBe('89504e47');
  });

  test('Rule 2: health returns 200 with status/database/time when DB works', async () => {
    const res = await request(app).get('/api/v1/health');
    if (res.status === 503) return; // DB not configured in this environment
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('ok');
    expect(typeof res.body.time).toBe('string');
    expect(res.body.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  test('Rule 2: health returns 503 DATABASE_DOWN when the DB is unreachable', async () => {
    const pool = require('../../src/db/pool');
    const originalQuery = pool.getPool().query.bind(pool.getPool());
    pool.getPool().query = () => Promise.reject(new Error('connection refused'));
    try {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('DATABASE_DOWN');
      expect(res.body.error.message).not.toContain('connection refused');
    } finally {
      pool.getPool().query = originalQuery;
    }
  });

  test('Rule 4: every error response matches {error:{code,message}}', async () => {
    const { rows } = await require('../../src/db/pool').getPool().query(
      'SELECT 1'
    ).catch(() => ({ rows: [] }));
    void rows;
    await createHost('librarian', 'secret123');

    const cases = [
      ['GET', '/api/v1/sessions/000000', null], // 404
      ['POST', '/api/v1/auth/login', { username: 'librarian', password: 'wrong' }], // 401
      ['POST', '/api/v1/auth/login', {}], // 400
      ['POST', '/api/v1/question-sets', { title: 'x' }], // 400 (no token)
      ['GET', '/api/v1/sessions/000000/leaderboard', null], // 404
    ];
    for (const [method, url, body] of cases) {
      const res = await request(app)[method.toLowerCase()](url).send(body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
      expect(typeof res.body.error.code).toBe('string');
      expect(res.body.error.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.message.length).toBeGreaterThan(0);
      expect(JSON.stringify(res.body)).not.toContain('stack');
    }
  });

  test('Rule 3: question-set round trip (POST then GET returns the same Rule 3 shape)', async () => {
    await createHost('librarian', 'secret123');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'secret123' });
    const token = login.body.token;

    const created = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${token}`)
      .send(rule3Set);
    expect(created.status).toBe(201);

    const fetched = await request(app)
      .get(`/api/v1/question-sets/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetched.status).toBe(200);

    // Same Rule 3 shape.
    expect(fetched.body.title).toBe(rule3Set.title);
    expect(fetched.body.questions).toHaveLength(1);
    expect(fetched.body.questions[0].text).toBe(rule3Set.questions[0].text);
    expect(fetched.body.questions[0].type).toBe(rule3Set.questions[0].type);
    expect(fetched.body.questions[0].choices).toEqual(rule3Set.questions[0].choices);
    expect(fetched.body.questions[0].correct_index).toBe(rule3Set.questions[0].correct_index);
    expect(fetched.body.questions[0].time_limit_sec).toBe(20); // default
  });

  test('Rule 3: a set with only contract fields is accepted; defaults applied', async () => {
    await createHost('librarian', 'secret123');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'secret123' });
    const res = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        title: 'Minimal Set',
        questions: [{ text: 'Q?', choices: ['a', 'b'], correct_index: 1 }],
      });
    expect(res.status).toBe(201);
    expect(res.body.questions[0].time_limit_sec).toBe(20);
  });

  test('Rule 5: join code never starts with 0; nickname rules enforced', async () => {
    await createHost('librarian', 'secret123');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'secret123' });
    const setRes = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send(rule3Set);
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ question_set_id: setRes.body.id });
    expect(sessionRes.status).toBe(201);
    expect(sessionRes.body.join_code).toMatch(/^[1-9][0-9]{5}$/);

    const shortNick = await request(app)
      .post(`/api/v1/sessions/${sessionRes.body.join_code}/players`)
      .send({ nickname: 'a' });
    expect(shortNick.status).toBe(400);
    expect(shortNick.body.error.code).toBe('VALIDATION_FAILED');
  });
});
