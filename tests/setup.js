require('dotenv').config();

// Tests run against a separate database. Point DATABASE_URL at the test DB
// before any module loads config.
if (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
