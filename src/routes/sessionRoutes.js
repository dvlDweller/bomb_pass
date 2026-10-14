const express = require('express');
const { z } = require('zod');
const SessionController = require('../controllers/SessionController');
const PlayerController = require('../controllers/PlayerController');
const AnswerController = require('../controllers/AnswerController');
const BombController = require('../controllers/BombController');
const LeaderboardController = require('../controllers/LeaderboardController');
const { requireHost, requirePlayer } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const startSessionSchema = z.object({
  question_set_id: z.number().int().positive('question_set_id must be a positive whole number.'),
});

const joinSchema = z.object({
  nickname: z.string().min(1, 'nickname is required.').max(20, 'nickname must be 2-20 characters.'),
});

const answerSchema = z.object({
  question_id: z.number().int().positive('question_id must be a positive whole number.'),
  choice_index: z
    .number()
    .int()
    .min(0, 'choice_index must be between 0 and 3.')
    .max(3, 'choice_index must be between 0 and 3.'),
});

const bombPassSchema = z.object({
  target_player_id: z.number().int().positive('target_player_id must be a positive whole number.'),
});

const patchSessionSchema = z.object({
  status: z.enum(['playing', 'ended'], {
    errorMap: () => ({ message: 'status must be "playing" or "ended".' }),
  }),
});

router.post('/', requireHost, validateBody(startSessionSchema), (req, res, next) => {
  SessionController.start(req, res).catch(next);
});

router.get('/', requireHost, (req, res, next) => {
  SessionController.list(req, res).catch(next);
});

router.get('/:code', (req, res, next) => {
  SessionController.get(req, res).catch(next);
});

router.patch('/:code', requireHost, validateBody(patchSessionSchema), (req, res, next) => {
  SessionController.updateStatus(req, res).catch(next);
});

router.post('/:code/players', validateBody(joinSchema), (req, res, next) => {
  PlayerController.join(req, res).catch(next);
});

router.get('/:code/players', (req, res, next) => {
  PlayerController.list(req, res).catch(next);
});

router.get('/:code/questions/current', requirePlayer, (req, res, next) => {
  AnswerController.currentQuestion(req, res).catch(next);
});

router.post('/:code/answers', requirePlayer, validateBody(answerSchema), (req, res, next) => {
  AnswerController.submit(req, res).catch(next);
});

router.post('/:code/bomb-passes', requirePlayer, validateBody(bombPassSchema), (req, res, next) => {
  BombController.pass(req, res).catch(next);
});

router.get('/:code/leaderboard', (req, res, next) => {
  LeaderboardController.get(req, res).catch(next);
});

router.get('/:code/results', requireHost, (req, res, next) => {
  SessionController.getResults(req, res).catch(next);
});

// A player leaves the game (self only; the controller checks the token).
router.delete('/:code/players/:id', requirePlayer, (req, res, next) => {
  PlayerController.forfeit(req, res).catch(next);
});

module.exports = router;
