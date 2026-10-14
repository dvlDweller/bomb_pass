const AnswerService = require('../services/AnswerService');

class AnswerController {
  async submit(req, res) {
    const result = await AnswerService.submit(req.playerUser, req.body);
    res.status(201).json(result);
  }

  async currentQuestion(req, res) {
    const result = await AnswerService.getCurrentQuestion(req.playerUser, req.params.code);
    res.status(200).json(result);
  }
}

module.exports = new AnswerController();
