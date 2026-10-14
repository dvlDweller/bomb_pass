const express = require('express');
const QuestionSetController = require('../controllers/QuestionSetController');
const { requireHost } = require('../middleware/auth');

const router = express.Router();

// Question-set JSON is validated/produced only by QuestionFactory (Rule 3).
router.post('/', requireHost, (req, res, next) => {
  QuestionSetController.create(req, res).catch(next);
});

// Import: same Rule 3 body as create, but a distinct URL.
router.post('/import', requireHost, (req, res, next) => {
  QuestionSetController.import(req, res).catch(next);
});

router.get('/', requireHost, (req, res, next) => {
  QuestionSetController.list(req, res).catch(next);
});

router.get('/:id/export', requireHost, (req, res, next) => {
  QuestionSetController.export(req, res).catch(next);
});

router.get('/:id', requireHost, (req, res, next) => {
  QuestionSetController.get(req, res).catch(next);
});

router.post('/:id/copy', requireHost, (req, res, next) => {
  QuestionSetController.copy(req, res).catch(next);
});

module.exports = router;
