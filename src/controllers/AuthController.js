const AuthService = require('../services/AuthService');

class AuthController {
  async login(req, res) {
    const result = await AuthService.login(req.body.username, req.body.password, req.ip);
    res.status(200).json(result);
  }
}

module.exports = new AuthController();
