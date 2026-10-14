const express = require('express');
const authRoutes = require('./authRoutes');
const questionSetRoutes = require('./questionSetRoutes');
const sessionRoutes = require('./sessionRoutes');
const HealthController = require('../controllers/HealthController');

const router = express.Router();

router.get('/health', (req, res, next) => {
  HealthController.health(req, res).catch(next);
});

router.get('/game-info', (req, res, next) => {
  HealthController.gameInfo(req, res).catch(next);
});

router.use('/auth', authRoutes);
router.use('/question-sets', questionSetRoutes);
router.use('/sessions', sessionRoutes);

module.exports = router;
