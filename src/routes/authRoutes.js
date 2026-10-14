const express = require('express');
const { z } = require('zod');
const AuthController = require('../controllers/AuthController');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const loginSchema = z.object({
  username: z.string({ required_error: 'username is required.' }).min(1, 'username is required.').max(50),
  password: z.string({ required_error: 'password is required.' }).min(1, 'password is required.'),
});

router.post('/login', validateBody(loginSchema), (req, res, next) => {
  AuthController.login(req, res).catch(next);
});

module.exports = router;
