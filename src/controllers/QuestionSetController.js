const QuestionSetService = require('../services/QuestionSetService');

class QuestionSetController {
  async create(req, res) {
    const result = await QuestionSetService.create(req.hostUser.id, req.body);
    res.status(201).json(result);
  }

  async list(req, res) {
    const result = await QuestionSetService.listForHost(req.hostUser.id);
    res.status(200).json(result);
  }

  async get(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'Question set id must be a positive whole number.' },
      });
    }
    const result = await QuestionSetService.getForHost(id, req.hostUser.id);
    res.status(200).json(result);
  }

  async export(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'Question set id must be a positive whole number.' },
      });
    }
    const result = await QuestionSetService.exportSet(id, req.hostUser.id);
    res.setHeader('Content-Disposition', `attachment; filename="question-set-${id}.json"`);
    res.status(200).json(result);
  }

  async import(req, res) {
    const result = await QuestionSetService.importSet(req.hostUser.id, req.body);
    res.status(201).json(result);
  }

  async copy(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'Question set id must be a positive whole number.' },
      });
    }
    const result = await QuestionSetService.copySet(id, req.hostUser.id);
    res.status(201).json(result);
  }
}

module.exports = new QuestionSetController();
