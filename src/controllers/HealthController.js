const config = require('../config');
const { getPool } = require('../db/pool');
const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const { toIsoUtc } = require('../utils/dates');

class HealthController {
  // Hub Contract Rule 2: 200 {status:"ok", database:"ok", time} when API and DB
  // both work (real SELECT 1); 503 DATABASE_DOWN when the DB is down.
  async health(req, res) {
    try {
      await getPool().query('SELECT 1');
      res.status(200).json({ status: 'ok', database: 'ok', time: toIsoUtc(new Date()) });
    } catch (err) {
      throw new AppError(503, errorCodes.DATABASE_DOWN, 'The game service is temporarily unavailable.');
    }
  }

  // Hub Contract Rule 1: game metadata, no token.
  async gameInfo(req, res) {
    res.status(200).json(config.gameInfo);
  }
}

module.exports = new HealthController();
