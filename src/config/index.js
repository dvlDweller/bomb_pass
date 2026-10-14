require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const jwtSecret = process.env.JWT_SECRET;
if (isProd && !jwtSecret) {
  throw new Error('JWT_SECRET is required in production');
}

const teamName = process.env.TEAM_NAME || 'Bomb Pass Team';
const section = process.env.SECTION || '3-2';

const gameInfo = {
  slug: 'bomb-pass',
  name: 'Bomb Pass',
  team: `${teamName} (BSCS ${section})`,
  description:
    'Answer questions and pass the bomb. When time runs out, the holder gets a penalty. Last player standing wins.',
  min_players: 3,
  max_players: 30,
  thumbnail_url: '/games/bomb-pass/thumbnail.png',
  play_url: '/games/bomb-pass/',
  version: '1.0.0',
};

// Hub Contract Rule 1: validate game-info on startup.
function validateGameInfo(info) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(info.slug)) {
    throw new Error(`game-info slug must be lowercase-hyphen: ${info.slug}`);
  }
  if (info.name.length > 40) {
    throw new Error('game-info name must be 40 characters or fewer');
  }
  if (info.description.length > 150 || !info.description.trim().endsWith('.')) {
    throw new Error('game-info description must be one sentence of 150 characters or fewer');
  }
  if (!/^\d+\.\d+\.\d+$/.test(info.version)) {
    throw new Error(`game-info version must be MAJOR.MINOR.PATCH: ${info.version}`);
  }
}
validateGameInfo(gameInfo);

// Bad-word filter for nicknames [ASSUMPTION: small English + Filipino starter
// list, easy to extend]. Matches whole words case-insensitively.
const BAD_WORDS = [
  'damn', 'hell', 'shit', 'fuck', 'bitch', 'bastard', 'asshole', 'cock', 'dick', 'pussy',
  'puta', 'putang', 'gago', 'gago ka', 'tanga', 'ulol', 'buang', 'leche', 'punyeta', 'kantot',
];

module.exports = {
  env,
  isProd,
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  dbSchema: process.env.DB_SCHEMA || 'bomb_pass',
  dbPoolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  jwtSecret: jwtSecret || 'bomb-pass-dev-secret-do-not-use-in-prod',
  hostTokenTtl: process.env.HOST_TOKEN_TTL || '8h',
  playerTokenTtl: process.env.PLAYER_TOKEN_TTL || '3h',
  bombTimerSeconds: parseInt(process.env.BOMB_TIMER_SECONDS || '30', 10),
  maxPlayers: parseInt(process.env.MAX_PLAYERS || '30', 10),
  hubOrigin: process.env.HUB_ORIGIN || '',
  allowLocalhostCors: env !== 'production',
  loginMaxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS || '5', 10),
  loginWindowMinutes: parseInt(process.env.LOGIN_WINDOW_MINUTES || '15', 10),
  gameInfo,
  badWords: BAD_WORDS,
};
