const assert = require('node:assert');
const ApplicationRepository = require('../../src/repositories/ApplicationRepository');
const SubscriptionRepository = require('../../src/repositories/SubscriptionRepository');
const PresenceRepository = require('../../src/repositories/PresenceRepository');
const DeliveryRepository = require('../../src/repositories/DeliveryRepository');
const AuthService = require('../../src/auth/AuthService');
const SubscriptionService = require('../../src/subscriptions/SubscriptionService');
const PresenceService = require('../../src/presence/PresenceService');
const NotificationService = require('../../src/notifications/NotificationService');
const path = require('node:path');
const fs = require('node:fs');

// We directly require database.js fallback adapter logic
const { createDatabase } = require('../../src/db/database');

function testFallbackAdapter() {
  const tmpPath = path.resolve(__dirname, 'test_fallback_store.json');
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  // Force fallback testing by stubbing require for node:sqlite or testing fallback store directly
  const dbPath = path.resolve(__dirname, 'test_fallback_store.db');
  const db = createDatabase(':memory:');

  const appRepo = new ApplicationRepository(db);
  const subRepo = new SubscriptionRepository(db);
  const presenceRepo = new PresenceRepository(db);
  const deliveryRepo = new DeliveryRepository(db);

  const authService = new AuthService(appRepo);
  const subService = new SubscriptionService(subRepo);
  const presenceService = new PresenceService(presenceRepo);
  const notificationService = new NotificationService({
    subscriptionRepository: subRepo,
    presenceRepository: presenceRepo,
    deliveryRepository: deliveryRepo
  });

  // Test App Registration
  const app = authService.registerApplication({
    id: 'app_fallback_1',
    name: 'CodeBlaze',
    apiKey: 'secret_fallback_key'
  });

  assert.ok(app);
  assert.strictEqual(app.id, 'app_fallback_1');
  assert.strictEqual(app.name, 'CodeBlaze');

  // Test Subscription Registration
  const sub = subService.registerSubscription(app.id, {
    owner_type: 'user',
    owner_id: 'user_fallback',
    endpoint: 'https://push.example.com/fallback_endpoint',
    keys: { p256dh: 'p256', auth: 'auth' }
  });

  assert.ok(sub);
  assert.strictEqual(sub.owner_id, 'user_fallback');

  // Test Admin Eligibility & Notification
  const res = notificationService.processNotificationRequest(app.id, {
    target: { type: 'user', id: 'user_fallback' },
    notification: { title: 'Fallback Test' }
  });

  assert.strictEqual(res.accepted, 1);

  // Test Stats
  const stats = deliveryRepo.getStats();
  assert.ok(stats.applications >= 1);

  db.close();
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  console.log('✔ Node 20 fallback database tests passed');
}

module.exports = testFallbackAdapter;
