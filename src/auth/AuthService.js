const crypto = require('node:crypto');
const { UnauthorizedError } = require('../errors/AppError');

class AuthService {
  constructor(applicationRepository) {
    this.applicationRepository = applicationRepository;
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  authenticate(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedError('Authorization header must use Bearer scheme');
    }

    const token = parts[1];
    if (!token) {
      throw new UnauthorizedError('Bearer token is required');
    }

    const tokenHash = this.hashToken(token);
    const app = this.applicationRepository.findByApiKeyHash(tokenHash);

    if (!app) {
      throw new UnauthorizedError('Invalid or inactive application credentials');
    }

    return app;
  }

  registerApplication({ id, name, apiKey }) {
    const tokenHash = this.hashToken(apiKey);
    return this.applicationRepository.create({
      id,
      name,
      apiKeyHash: tokenHash
    });
  }
}

module.exports = AuthService;
