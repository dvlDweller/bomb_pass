const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');
const PlayerService = require('../services/PlayerService');

class PlayerController {
  async join(req, res) {
    const result = await PlayerService.join(req.params.code, req.body.nickname);
    res.status(201).json(result);
  }

  async list(req, res) {
    const result = await PlayerService.listByCode(req.params.code);
    res.status(200).json(result);
  }

  // A player leaves the game. The token's player must match the {id} in the URL.
  async forfeit(req, res) {
    const playerId = Number(req.params.id);
    if (!Number.isInteger(playerId) || playerId <= 0) {
      throw new AppError(400, errorCodes.VALIDATION_FAILED, 'Player id must be a positive whole number.');
    }
    if (req.playerUser.id !== playerId) {
      throw new AppError(403, errorCodes.NOT_YOUR_SESSION, 'You can only leave the game yourself.');
    }
    const result = await PlayerService.forfeit(req.params.code, playerId);
    res.status(200).json(result);
  }
}

module.exports = new PlayerController();
