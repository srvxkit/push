class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request input', errorCode = 'INVALID_INPUT') {
    super(message, 422, errorCode);
  }
}

class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload size limit exceeded') {
    super(message, 413, 'PAYLOAD_TOO_LARGE');
  }
}

module.exports = {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  PayloadTooLargeError
};
