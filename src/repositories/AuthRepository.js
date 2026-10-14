const { getPool } = require('../db/pool');

class AuthRepository {
  async findByUsername(username) {
    const { rows } = await getPool().query('SELECT * FROM hosts WHERE username = $1', [username]);
    return rows[0] || null;
  }

  async countRecentFailures(username, windowMinutes) {
    const { rows } = await getPool().query(
      `SELECT COUNT(*)::int AS count FROM login_attempts
       WHERE username = $1 AND attempted_at > now() - ($2 || ' minutes')::interval`,
      [username, String(windowMinutes)]
    );
    return rows[0].count;
  }

  async recordFailure(username, ipHash) {
    await getPool().query('INSERT INTO login_attempts (username, ip_hash) VALUES ($1, $2)', [
      username,
      ipHash,
    ]);
  }

  async clearFailures(username) {
    await getPool().query('DELETE FROM login_attempts WHERE username = $1', [username]);
  }
}

module.exports = new AuthRepository();
