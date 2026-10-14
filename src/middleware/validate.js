// Validates req.body against a zod schema. On failure the error middleware
// answers 400 with the single { "error": { "code", "message" } } format.
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(result.error);
    }
    req.body = result.data;
    next();
  };
}

module.exports = { validateBody };
