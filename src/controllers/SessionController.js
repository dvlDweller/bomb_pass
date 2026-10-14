const SessionService = require('../services/SessionService');

class SessionController {
  async start(req, res) {
    const result = await SessionService.start(req.hostUser.id, req.body.question_set_id);
    res.status(201).json(result);
  }

  async list(req, res) {
    const result = await SessionService.listForHost(req.hostUser.id);
    res.status(200).json(result);
  }

  async get(req, res) {
    const result = await SessionService.getByCode(req.params.code);
    res.status(200).json(result);
  }

  async updateStatus(req, res) {
    const result = await SessionService.updateStatus(req.params.code, req.hostUser.id, req.body.status);
    res.status(200).json(result);
  }

  async getResults(req, res) {
    const result = await SessionService.getResults(req.params.code, req.hostUser.id);
    res.status(200).json(result);
  }
}

module.exports = new SessionController();
