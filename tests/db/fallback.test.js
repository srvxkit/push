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

const { createDatabase } = require('../../src/db/database');

function testJsonDatabase() {
  const tmpPath = path.resolve(__dirname, 'test_json_store.json');
  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  const db = createDatabase(tmpPath);

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
    id: 'app_json_1',
    name: 'CodeBlaze',
    apiKey: 'secret_json_key'
  });

  assert.ok(app);
  assert.strictEqual(app.id, 'app_json_1');
  assert.strictEqual(app.name, 'CodeBlaze');

  // Test Subscription Registration
  const sub = subService.registerSubscription(app.id, {
    owner_type: 'user',
    owner_id: 'user_json',
    endpoint: 'https://push.example.com/json_endpoint',
    keys: { p256dh: 'p256', auth: 'auth' }
  });

  assert.ok(sub);
  assert.strictEqual(sub.owner_id, 'user_json');

  // Test Admin Eligibility & Notification
  const res = notificationService.processNotificationRequest(app.id, {
    target: { type: 'user', id: 'user_json' },
    notification: { title: 'JSON Database Test' }
  });

  assert.strictEqual(res.accepted, 1);

  // Test Stats
  const stats = deliveryRepo.getStats();
  assert.ok(stats.applications >= 1);

  db.close();

  // Verify file was written to disk
  assert.strictEqual(fs.existsSync(tmpPath), true);
  const content = JSON.parse(fs.readFileSync(tmpPath, 'utf8'));
  assert.ok(content.applications.length > 0);

  if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

  console.log('✔ Pure JSON database file saving tests passed');
}

module.exports = testJsonDatabase;
