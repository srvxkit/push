const assert = require('node:assert');
const { createDatabase } = require('../../src/db/database');
const ApplicationRepository = require('../../src/repositories/ApplicationRepository');
const PresenceRepository = require('../../src/repositories/PresenceRepository');
const PresenceService = require('../../src/presence/PresenceService');
const { ValidationError } = require('../../src/errors/AppError');

function testPresence() {
  const db = createDatabase(':memory:');
  const appRepo = new ApplicationRepository(db);
  const presenceRepo = new PresenceRepository(db);
  const presenceService = new PresenceService(presenceRepo, 300);

  appRepo.create({ id: 'app_1', name: 'App One', apiKeyHash: 'hash_1' });
  appRepo.create({ id: 'app_2', name: 'App Two', apiKeyHash: 'hash_2' });

  // 1. Record heartbeat
  const presence = presenceService.recordHeartbeat('app_1', {
    owner_type: 'admin',
    owner_id: 'admin_5',
    session_id: 'sess_abc123',
    ttl_seconds: 60
  });

  assert.ok(presence.id);
  assert.strictEqual(presence.owner_id, 'admin_5');

  // 2. Active presence check
  const isActive = presenceService.hasActivePresence('app_1', null, 'admin', 'admin_5');
  assert.strictEqual(isActive, true);

  // 3. App isolation check (App 2 does not have active presence)
  const isApp2Active = presenceService.hasActivePresence('app_2', null, 'admin', 'admin_5');
  assert.strictEqual(isApp2Active, false);

  // 4. Logout session
  presenceService.recordLogout('app_1', { session_id: 'sess_abc123' });
  const isStillActive = presenceService.hasActivePresence('app_1', null, 'admin', 'admin_5');
  assert.strictEqual(isStillActive, false);

  // 5. Validation checks
  assert.throws(() => {
    presenceService.recordHeartbeat('app_1', { owner_type: 'admin', owner_id: 'admin_5' });
  }, ValidationError);

  db.close();
  console.log('✔ Presence tests passed');
}

module.exports = testPresence;
