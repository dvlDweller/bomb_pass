const AppError = require('../utils/AppError');
const errorCodes = require('../utils/errorCodes');

// Hub Contract Rule 4: ONE error format from this single middleware:
// { "error": { "code": "UPPER_SNAKE_CASE", "message": "..." } }
// Never leaks stack traces, SQL errors, or internal details.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err && err.name === 'ZodError') {
    const first = err.errors && err.errors[0];
    const message = first ? first.message : 'The request is not valid.';
    return res
      .status(400)
      .json({ error: { code: errorCodes.VALIDATION_FAILED, message } });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: errorCodes.VALIDATION_FAILED, message: 'The request body is not valid JSON.' },
    });
  }
  if (err && err.code === '23505') {
    return res.status(409).json({
      error: { code: errorCodes.VALIDATION_FAILED, message: 'That value is already taken.' },
    });
  }
  console.error(err);
  return res.status(500).json({
    error: {
      code: errorCodes.SERVER_ERROR,
      message: 'Something went wrong on our end. Please try again later.',
    },
  });
}

module.exports = errorHandler;
