const { AppError } = require('../../errors/AppError');

function createCryptoAuthMiddleware(applicationRepository) {
  return function verifyRequest(req) {
    const authHeader = req.headers.authorization;
    const appKeyHeader = req.headers['x-application-key'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (appKeyHeader) {
      token = String(appKeyHeader).trim();
    }

    if (!token) {
      const err = new AppError('Missing authorization token or X-Application-Key header', 401, 'UNAUTHORIZED');
      return { success: false, error: err };
    }

    const app = applicationRepository.findByApiKey(token);
    if (!app) {
      const err = new AppError('Invalid application key', 401, 'UNAUTHORIZED');
      return { success: false, error: err };
    }

    return { success: true, application: app };
  };
}

module.exports = createCryptoAuthMiddleware;
