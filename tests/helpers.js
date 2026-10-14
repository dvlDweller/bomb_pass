const bcrypt = require('bcrypt');
const { getPool } = require('../src/db/pool');
const { migrate } = require('../src/db/migrate');

const TABLES = [
  'login_attempts',
  'leaderboards',
  'penalties',
  'answers',
  'players',
  'sessions',
  'choices',
  'questions',
  'question_sets',
  'hosts',
];

async function resetDb() {
  const pool = getPool();
  await pool.query(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
}

async function setupTestDb() {
  await migrate();
  await resetDb();
}

async function closeDb() {
  await getPool().end();
}

async function createHost(username = 'librarian', password = 'secret123') {
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await getPool().query(
    'INSERT INTO hosts (username, password_hash) VALUES ($1, $2) RETURNING *',
    [username, hash]
  );
  return rows[0];
}

// Hub Contract Rule 3 shape: text/type/choices/correct_index/time_limit_sec.
async function createQuestionSet(hostId, overrides = {}) {
  const { rows } = await getPool().query(
    `INSERT INTO question_sets (host_id, title, description, subject, grade_level)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [hostId, overrides.title || 'Test Set', overrides.description || '', overrides.subject || '', overrides.grade_level || '']
  );
  const set = rows[0];
  const questions = overrides.questions || [
    {
      text: 'What is 2+2?',
      type: 'multiple_choice',
      choices: ['3', '4', '5', '22'],
      correct_index: 1,
      time_limit_sec: 20,
      points: 100,
    },
    {
      text: 'The sky is blue.',
      type: 'true_false',
      choices: ['True', 'False'],
      correct_index: 0,
      time_limit_sec: 10,
      points: 200,
    },
  ];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qRes = await getPool().query(
      `INSERT INTO questions (question_set_id, position, text, type, correct_index, time_limit_sec, points)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [set.id, i, q.text, q.type, q.correct_index, q.time_limit_sec || 20, q.points || 100]
    );
    for (let c = 0; c < q.choices.length; c++) {
      await getPool().query(
        'INSERT INTO choices (question_id, choice_index, choice_text) VALUES ($1, $2, $3)',
        [qRes.rows[0].id, c, q.choices[c]]
      );
    }
  }
  return set;
}

async function createSession(hostId, questionSetId, overrides = {}) {
  const { rows } = await getPool().query(
    `INSERT INTO sessions (host_id, question_set_id, join_code, status)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [hostId, questionSetId, overrides.join_code || '123456', overrides.status || 'waiting']
  );
  return rows[0];
}

async function createPlayer(sessionId, nickname, overrides = {}) {
  const { rows } = await getPool().query(
    `INSERT INTO players (session_id, nickname, score, penalty_count, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [sessionId, nickname, overrides.score || 0, overrides.penalty_count || 0, overrides.status || 'active']
  );
  return rows[0];
}

async function setBomb(sessionId, holderId, expiresAt) {
  await getPool().query('UPDATE sessions SET bomb_holder_id = $2, bomb_expires_at = $3 WHERE id = $1', [
    sessionId,
    holderId,
    expiresAt,
  ]);
}

async function setPenaltyCount(playerId, count) {
  await getPool().query('UPDATE players SET penalty_count = $2 WHERE id = $1', [playerId, count]);
}

async function getSessionById(id) {
  const { rows } = await getPool().query('SELECT * FROM sessions WHERE id = $1', [id]);
  return rows[0];
}

async function getPlayerById(id) {
  const { rows } = await getPool().query('SELECT * FROM players WHERE id = $1', [id]);
  return rows[0];
}

module.exports = {
  resetDb,
  setupTestDb,
  closeDb,
  createHost,
  createQuestionSet,
  createSession,
  createPlayer,
  setBomb,
  setPenaltyCount,
  getSessionById,
  getPlayerById,
};
