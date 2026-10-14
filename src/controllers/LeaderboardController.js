const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const SessionStateService = require('../services/SessionStateService');
const LeaderboardService = require('../services/LeaderboardService');

class LeaderboardController {
  async get(req, res) {
    // Reconcile first so eliminations and the winner are reflected.
    const session = await SessionStateService.reconcile(req.params.code);
    if (!session) {
      throw new AppError(404, errorCodes.SESSION_NOT_FOUND, `No game uses the join code ${req.params.code}.`);
    }
    const result = await LeaderboardService.getForSession(session.id);
    res.status(200).json(result);
  }
}

module.exports = new LeaderboardController();
