const BombService = require('../services/BombService');

class BombController {
  async pass(req, res) {
    const result = await BombService.pass(req.playerUser, req.params.code, req.body.target_player_id);
    res.status(200).json(result);
  }
}

module.exports = new BombController();
