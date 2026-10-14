// Hub Contract Rule 4: one error shape for the whole API, produced by a
// single error-handling middleware: { error: { code, message } }.
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
  }
}

module.exports = AppError;
