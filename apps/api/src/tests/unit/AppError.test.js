const AppError = require('../../utils/AppError');

describe('AppError', () => {
  test('sets message, statusCode, code, and isOperational', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.isOperational).toBe(true);
  });

  test('defaults to 500 statusCode and INTERNAL_ERROR code', () => {
    const err = new AppError('Oops');
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
  });

  test('is an instance of Error', () => {
    const err = new AppError('Test error');
    expect(err).toBeInstanceOf(Error);
  });

  test('captures stack trace', () => {
    const err = new AppError('Stack test', 400, 'BAD_INPUT');
    expect(err.stack).toBeDefined();
  });

  test('isOperational is always true', () => {
    const err = new AppError('Auth error', 401, 'AUTH_REQUIRED');
    expect(err.isOperational).toBe(true);
  });
});
