require('dotenv').config();
const bcrypt = require('bcrypt');
const { getPool } = require('../../src/db/pool');

// Seeds one host account. There is intentionally no host registration endpoint.
async function seed() {
  const username = process.env.SEED_HOST_USERNAME || 'librarian';
  const password = process.env.SEED_HOST_PASSWORD || 'Librarian123!';
  const pool = getPool();
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO hosts (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, username`,
    [username, hash]
  );
  console.log(`Seeded host account: ${rows[0].username} (id=${rows[0].id})`);
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seed };
