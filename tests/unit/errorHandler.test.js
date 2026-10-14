const errorHandler = require('../../src/middleware/errorHandler');
const AppError = require('../../src/utils/AppError');
const errorCodes = require('../../src/utils/errorCodes');

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('error-handling middleware (Hub Contract Rule 4)', () => {
  test('AppError produces {error:{code,message}} with the right status', () => {
    const res = mockRes();
    errorHandler(new AppError(404, errorCodes.SESSION_NOT_FOUND, 'No game uses the join code 999999.'), {}, res, () => {});
    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'SESSION_NOT_FOUND', message: 'No game uses the join code 999999.' },
    });
  });

  test('every documented code is UPPER_SNAKE_CASE', () => {
    const codes = Object.values(errorCodes);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  test('unknown exception becomes 500 SERVER_ERROR with a generic message', () => {
    const res = mockRes();
    const leaky = new Error('secret detail: password=hunter2 SQL: SELECT * FROM hosts');
    errorHandler(leaky, {}, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('SERVER_ERROR');
    expect(res.body.error.message).not.toContain('hunter2');
    expect(res.body.error.message).not.toContain('SELECT');
    expect(res.body.error.message).not.toContain('secret detail');
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });

  test('malformed JSON body becomes 400 VALIDATION_FAILED', () => {
    const res = mockRes();
    errorHandler({ type: 'entity.parse.failed' }, {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  test('zod errors become 400 VALIDATION_FAILED', () => {
    const res = mockRes();
    const zodError = Object.assign(new Error('bad'), {
      name: 'ZodError',
      errors: [{ message: 'title must be 3-80 characters.' }],
    });
    errorHandler(zodError, {}, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.message).toBe('title must be 3-80 characters.');
  });
});
