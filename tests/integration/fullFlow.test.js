const request = require('supertest');
const createApp = require('../../src/app');
const { getPool } = require('../../src/db/pool');
const { setupTestDb, resetDb, closeDb, createHost } = require('../helpers');

const hasDb = !!process.env.TEST_DATABASE_URL;
const maybeDescribe = hasDb ? describe : describe.skip;

const app = createApp();

// Hub Contract v1 Rule 3 format.
const questionSetPayload = {
  title: 'Philippine Literature',
  description: 'Questions about Philippine literature',
  subject: 'Literature',
  grade_level: 'Grade 11',
  questions: [
    {
      text: 'Who wrote Noli Me Tangere?',
      type: 'multiple_choice',
      choices: ['Jose Rizal', 'Andres Bonifacio', 'Apolinario Mabini', 'Emilio Aguinaldo'],
      correct_index: 0,
      time_limit_sec: 20,
    },
    {
      text: 'The sky is blue.',
      type: 'true_false',
      choices: ['True', 'False'],
      correct_index: 0,
      time_limit_sec: 10,
    },
  ],
};

maybeDescribe('Bomb Pass - full game flow', () => {
  let hostToken;
  let code;
  let playerTokens;
  let playerIds;

  beforeAll(setupTestDb);
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await closeDb();
  });

  test('health and game-info work without a token', async () => {
    const health = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(health.status);

    const info = await request(app).get('/api/v1/game-info');
    expect(info.status).toBe(200);
    expect(info.body.slug).toBe('bomb-pass');
    expect(info.body.name).toBe('Bomb Pass');
    expect(info.body.description).toBe(
      'Answer questions and pass the bomb. When time runs out, the holder gets a penalty. Last player standing wins.'
    );
    expect(info.body.min_players).toBe(3);
    expect(info.body.max_players).toBe(30);
    expect(info.body.thumbnail_url).toBe('/games/bomb-pass/thumbnail.png');
    expect(info.body.play_url).toBe('/games/bomb-pass/');
    expect(info.body.version).toBe('1.0.0');
    expect(info.body.team).toContain('BSCS');
  });

  test('login returns a host token; bad credentials get 401; missing fields get 400', async () => {
    await createHost('librarian', 'secret123');

    const badFields = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian' });
    expect(badFields.status).toBe(400);
    expect(badFields.body.error.code).toBe('VALIDATION_FAILED');

    const badCreds = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'wrong' });
    expect(badCreds.status).toBe(401);
    expect(badCreds.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
    });

    const ok = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeDefined();
    expect(ok.body.username).toBe('librarian');
    hostToken = ok.body.token;
  });

  test('question set creation, ownership, round trip, and no correct_index leakage', async () => {
    await createHost('librarian', 'secret123');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'secret123' });
    const token = login.body.token;

    const noAuth = await request(app).post('/api/v1/question-sets').send(questionSetPayload);
    expect(noAuth.status).toBe(401);
    expect(noAuth.body.error.code).toBe('AUTH_REQUIRED');

    const badSet = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...questionSetPayload, questions: [] });
    expect(badSet.status).toBe(400);
    expect(badSet.body.error.code).toBe('VALIDATION_FAILED');

    const created = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${token}`)
      .send(questionSetPayload);
    expect(created.status).toBe(201);
    expect(created.body.question_count).toBe(2);
    expect(created.body.title).toBe('Philippine Literature');
    expect(created.body.questions[0].correct_index).toBe(0); // host may see it

    // Round trip: POST then GET returns the same Rule 3 shape.
    const detail = await request(app)
      .get(`/api/v1/question-sets/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.title).toBe(created.body.title);
    expect(detail.body.questions).toHaveLength(2);
    expect(detail.body.questions[0].text).toBe('Who wrote Noli Me Tangere?');
    expect(detail.body.questions[0].choices).toEqual([
      'Jose Rizal',
      'Andres Bonifacio',
      'Apolinario Mabini',
      'Emilio Aguinaldo',
    ]);
    expect(detail.body.questions[0].correct_index).toBe(0);
    expect(detail.body.questions[0].time_limit_sec).toBe(20);
    expect(detail.body.questions[1].type).toBe('true_false');

    const list = await request(app)
      .get('/api/v1/question-sets')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].subject).toBe('Literature');

    // Another host cannot see or fetch the set.
    await createHost('intruder', 'secret123');
    const intruderLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'intruder', password: 'secret123' });
    const forbidden = await request(app)
      .get(`/api/v1/question-sets/${created.body.id}`)
      .set('Authorization', `Bearer ${intruderLogin.body.token}`);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('NOT_YOUR_QUESTION_SET');
  });

  test('full game: create, join x3, start, answer, pass, expire, eliminate, win, leaderboard', async () => {
    await createHost('librarian', 'secret123');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'secret123' });
    const token = login.body.token;

    const setRes = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${token}`)
      .send(questionSetPayload);
    const setId = setRes.body.id;

    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ question_set_id: setId });
    expect(sessionRes.status).toBe(201);
    expect(sessionRes.body.status).toBe('waiting');
    expect(sessionRes.body.join_code).toMatch(/^[1-9][0-9]{5}$/);
    code = sessionRes.body.join_code;

    // Join rules
    const badCode = await request(app)
      .post('/api/v1/sessions/abc/players')
      .send({ nickname: 'X' });
    expect(badCode.status).toBe(400);
    expect(badCode.body.error.code).toBe('VALIDATION_FAILED');
    const unknownCode = await request(app)
      .post('/api/v1/sessions/999999/players')
      .send({ nickname: 'Unknown' });
    expect(unknownCode.status).toBe(404);
    expect(unknownCode.body.error.code).toBe('SESSION_NOT_FOUND');
    const emptyNick = await request(app)
      .post(`/api/v1/sessions/${code}/players`)
      .send({ nickname: '   ' });
    expect(emptyNick.status).toBe(400);

    playerTokens = [];
    playerIds = [];
    for (const nick of ['Alice', 'Bob', 'Carol']) {
      const join = await request(app)
        .post(`/api/v1/sessions/${code}/players`)
        .send({ nickname: nick });
      expect(join.status).toBe(201);
      expect(join.body.token).toBeDefined();
      expect(join.body.score).toBe(0);
      expect(join.body.penalty_count).toBe(0);
      expect(join.body.status).toBe('active');
      playerTokens.push(join.body.token);
      playerIds.push(join.body.id);
    }

    const dupNick = await request(app)
      .post(`/api/v1/sessions/${code}/players`)
      .send({ nickname: 'Alice' });
    expect(dupNick.status).toBe(409);
    expect(dupNick.body.error.code).toBe('NICKNAME_TAKEN');

    const playersList = await request(app).get(`/api/v1/sessions/${code}/players`);
    expect(playersList.status).toBe(200);
    expect(playersList.body).toHaveLength(3);

    const sessionView = await request(app).get(`/api/v1/sessions/${code}`);
    expect(sessionView.status).toBe(200);
    expect(sessionView.body.status).toBe('waiting');
    expect(sessionView.body.player_count).toBe(3);
    expect(sessionView.body.server_time).toBeDefined();

    // Starting with a player token is forbidden (wrong token type).
    const wrongType = await request(app)
      .patch(`/api/v1/sessions/${code}`)
      .set('Authorization', `Bearer ${playerTokens[0]}`)
      .send({ status: 'playing' });
    expect(wrongType.status).toBe(403);
    expect(wrongType.body.error.code).toBe('WRONG_TOKEN_TYPE');

    const start = await request(app)
      .patch(`/api/v1/sessions/${code}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'playing' });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('playing');
    expect(start.body.bomb_holder_id).not.toBeNull();
    expect(start.body.bomb_holder_nickname).toBeDefined();
    expect(new Date(start.body.bomb_expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(start.body.question_expires_at).getTime()).toBeGreaterThan(Date.now());

    // Joining after start gets 409 SESSION_ALREADY_STARTED.
    const lateJoin = await request(app)
      .post(`/api/v1/sessions/${code}/players`)
      .send({ nickname: 'Late' });
    expect(lateJoin.status).toBe(409);
    expect(lateJoin.body.error.code).toBe('SESSION_ALREADY_STARTED');

    // Current question: no correct_index anywhere.
    const currentQ = await request(app)
      .get(`/api/v1/sessions/${code}/questions/current`)
      .set('Authorization', `Bearer ${playerTokens[0]}`);
    expect(currentQ.status).toBe(200);
    expect(currentQ.body.choices).toHaveLength(4);
    expect(currentQ.body.time_limit_sec).toBe(20);
    expect(currentQ.body.points).toBe(100);
    expect(JSON.stringify(currentQ.body)).not.toContain('correct_index');

    // Find the holder and answer correctly (correct_index 0 in our set).
    const holderId = start.body.bomb_holder_id;
    const holderIndex = playerIds.indexOf(holderId);
    const answer = await request(app)
      .post(`/api/v1/sessions/${code}/answers`)
      .set('Authorization', `Bearer ${playerTokens[holderIndex]}`)
      .send({ question_id: currentQ.body.question_id, choice_index: 0 });
    expect(answer.status).toBe(201);
    expect(answer.body.correct).toBe(true);
    expect(answer.body.score).toBe(100);
    expect(answer.body.rank).toBe(1);

    // Duplicate answer gets 409 ALREADY_ANSWERED.
    const dupAnswer = await request(app)
      .post(`/api/v1/sessions/${code}/answers`)
      .set('Authorization', `Bearer ${playerTokens[holderIndex]}`)
      .send({ question_id: currentQ.body.question_id, choice_index: 1 });
    expect(dupAnswer.status).toBe(409);
    expect(dupAnswer.body.error.code).toBe('ALREADY_ANSWERED');

    // Non-holder cannot pass the bomb.
    const nonHolder = (holderIndex + 1) % 3;
    const forbiddenPass = await request(app)
      .post(`/api/v1/sessions/${code}/bomb-passes`)
      .set('Authorization', `Bearer ${playerTokens[nonHolder]}`)
      .send({ target_player_id: playerIds[(holderIndex + 2) % 3] });
    expect(forbiddenPass.status).toBe(403);
    expect(forbiddenPass.body.error.code).toBe('NOT_BOMB_HOLDER');

    // Holder passes to another player; timer resets.
    const targetId = playerIds[(holderIndex + 1) % 3];
    const pass = await request(app)
      .post(`/api/v1/sessions/${code}/bomb-passes`)
      .set('Authorization', `Bearer ${playerTokens[holderIndex]}`)
      .send({ target_player_id: targetId });
    expect(pass.status).toBe(200);
    expect(pass.body).toEqual({
      new_holder_id: targetId,
      new_holder_nickname: ['Alice', 'Bob', 'Carol'][(holderIndex + 1) % 3],
      timer_reset: true,
      bomb_expires_at: pass.body.bomb_expires_at,
    });

    // Let the deadline lapse: force expiry, then poll -> penalty applied.
    // The holder is at 2 penalties, so the expiration eliminates them and the
    // bomb must move (deterministic).
    await getPool().query('UPDATE players SET penalty_count = 2 WHERE id = $1', [targetId]);
    await getPool().query(
      `UPDATE sessions SET bomb_expires_at = now() - interval '1 second' WHERE join_code = $1`,
      [code]
    );
    const afterExpiry = await request(app).get(`/api/v1/sessions/${code}`);
    expect(afterExpiry.status).toBe(200);
    expect(afterExpiry.body.bomb_holder_id).not.toBe(targetId);
    expect(new Date(afterExpiry.body.bomb_expires_at).getTime()).toBeGreaterThan(Date.now());

    // Drive the game to a winner: set two players to 2 penalties and force expiry.
    const { rows: players } = await getPool().query(
      'SELECT * FROM players WHERE session_id = (SELECT id FROM sessions WHERE join_code = $1)',
      [code]
    );
    const others = players.filter((p) => p.status === 'active').slice(0, 2);
    for (const p of others) {
      await getPool().query('UPDATE players SET penalty_count = 2 WHERE id = $1', [p.id]);
    }
    await getPool().query(
      `UPDATE sessions SET bomb_expires_at = now() - interval '61 seconds' WHERE join_code = $1`,
      [code]
    );
    const finalView = await request(app).get(`/api/v1/sessions/${code}`);
    expect(finalView.status).toBe(200);
    expect(finalView.body.status).toBe('ended');
    expect(finalView.body.winner_nickname).toBeDefined();

    const leaderboard = await request(app).get(`/api/v1/sessions/${code}/leaderboard`);
    expect(leaderboard.status).toBe(200);
    expect(leaderboard.body.length).toBe(3);
    expect(leaderboard.body[0].nickname).toBe(finalView.body.winner_nickname);
    expect(leaderboard.body[0].rank).toBe(1);
    const eliminated = leaderboard.body.filter((r) => r.status === 'eliminated');
    expect(eliminated.length).toBe(2);
  });

  test('starting with fewer than 3 players gets 409; ending works for the host', async () => {
    await createHost('librarian', 'secret123');
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'librarian', password: 'secret123' });
    const token = login.body.token;
    const setRes = await request(app)
      .post('/api/v1/question-sets')
      .set('Authorization', `Bearer ${token}`)
      .send(questionSetPayload);
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ question_set_id: setRes.body.id });
    const onePlayer = await request(app)
      .post(`/api/v1/sessions/${sessionRes.body.join_code}/players`)
      .send({ nickname: 'Solo' });
    expect(onePlayer.status).toBe(201);

    const tooFew = await request(app)
      .patch(`/api/v1/sessions/${sessionRes.body.join_code}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'playing' });
    expect(tooFew.status).toBe(409);
    expect(tooFew.body.error.code).toBe('NOT_ENOUGH_PLAYERS');

    // A second host cannot patch someone else's session.
    await createHost('other', 'secret123');
    const otherLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'other', password: 'secret123' });
    const notOwner = await request(app)
      .patch(`/api/v1/sessions/${sessionRes.body.join_code}`)
      .set('Authorization', `Bearer ${otherLogin.body.token}`)
      .send({ status: 'playing' });
    expect(notOwner.status).toBe(403);
    expect(notOwner.body.error.code).toBe('NOT_YOUR_SESSION');

    // Host can list their sessions and end a started one.
    // With a 3-player minimum, join two more players before starting.
    const twoPlayers = await request(app)
      .post(`/api/v1/sessions/${sessionRes.body.join_code}/players`)
      .send({ nickname: 'Duo' });
    expect(twoPlayers.status).toBe(201);
    const threePlayers = await request(app)
      .post(`/api/v1/sessions/${sessionRes.body.join_code}/players`)
      .send({ nickname: 'Trio' });
    expect(threePlayers.status).toBe(201);
    const started = await request(app)
      .patch(`/api/v1/sessions/${sessionRes.body.join_code}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'playing' });
    expect(started.status).toBe(200);
    const ended = await request(app)
      .patch(`/api/v1/sessions/${sessionRes.body.join_code}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ended' });
    expect(ended.status).toBe(200);
    expect(ended.body.status).toBe('ended');
    // Both players tie on score and penalties; the ranking is stable, so the
    // first-joined active player (Solo) is rank 1.
    expect(ended.body.winner_nickname).toBe('Solo');

    const mySessions = await request(app)
      .get('/api/v1/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(mySessions.status).toBe(200);
    expect(mySessions.body.length).toBe(1);
    expect(mySessions.body[0].status).toBe('ended');
    expect(mySessions.body[0].winner_nickname).toBe('Solo');
  });
});
