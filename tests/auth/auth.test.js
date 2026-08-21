const assert = require('node:assert');
const { createDatabase } = require('../../src/db/database');
const ApplicationRepository = require('../../src/repositories/ApplicationRepository');
const AuthService = require('../../src/auth/AuthService');
const { UnauthorizedError } = require('../../src/errors/AppError');

function testAuth() {
  const db = createDatabase(':memory:');
  const appRepo = new ApplicationRepository(db);
  const authService = new AuthService(appRepo);

  // 1. Register application
  const app = authService.registerApplication({
    id: 'app_test_1',
    name: 'Test App 1',
    apiKey: 'secret-token-123'
  });

  assert.strictEqual(app.id, 'app_test_1');
  assert.strictEqual(app.name, 'Test App 1');

  // 2. Authenticate with valid Bearer token
  const authenticated = authService.authenticate('Bearer secret-token-123');
  assert.strictEqual(authenticated.id, 'app_test_1');

  // 3. Reject invalid token
  assert.throws(() => {
    authService.authenticate('Bearer invalid-token');
  }, UnauthorizedError);

  // 4. Reject missing Header
  assert.throws(() => {
    authService.authenticate(null);
  }, UnauthorizedError);

  // 5. Reject malformed scheme
  assert.throws(() => {
    authService.authenticate('Basic secret-token-123');
  }, UnauthorizedError);

  db.close();
  console.log('✔ Auth tests passed');
}

module.exports = testAuth;
