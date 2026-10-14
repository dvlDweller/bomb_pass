const { Pool } = require('pg');
const config = require('../config');

// Singleton: one module-level pool reused across warm serverless invocations.
let pool = null;

function getPool() {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.dbPoolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    // Every connection uses the bomb_pass schema (env DB_SCHEMA).
    pool.on('connect', (client) => {
      client.query(`SET search_path TO ${config.dbSchema}, public`).catch((err) => {
        console.error('Failed to set search_path', err);
      });
    });
    pool.on('error', (err) => {
      console.error('Unexpected idle pg client error', err);
    });
  }
  return pool;
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getPool, withTransaction };
