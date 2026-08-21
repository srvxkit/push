const assert = require('node:assert');
const { createDatabase } = require('../../src/db/database');
const ApplicationRepository = require('../../src/repositories/ApplicationRepository');
const SubscriptionRepository = require('../../src/repositories/SubscriptionRepository');
const PresenceRepository = require('../../src/repositories/PresenceRepository');
const DeliveryRepository = require('../../src/repositories/DeliveryRepository');
const SubscriptionService = require('../../src/subscriptions/SubscriptionService');
const PresenceService = require('../../src/presence/PresenceService');
const NotificationService = require('../../src/notifications/NotificationService');

function testAdminEligibility() {
  const db = createDatabase(':memory:');
  const appRepo = new ApplicationRepository(db);
  const subRepo = new SubscriptionRepository(db);
  const presenceRepo = new PresenceRepository(db);
  const deliveryRepo = new DeliveryRepository(db);

  const appId = 'app_test';
  appRepo.create({ id: appId, name: 'Admin Test App', apiKeyHash: 'hash_admin' });

  const subService = new SubscriptionService(subRepo);
  const presenceService = new PresenceService(presenceRepo);
  const notificationService = new NotificationService({
    subscriptionRepository: subRepo,
    presenceRepository: presenceRepo,
    deliveryRepository: deliveryRepo
  });

  // --- Scenario 1: Logged in + Subscribed -> SEND ---
  const subAdmin1 = subService.registerSubscription(appId, {
    owner_type: 'admin',
    owner_id: 'admin_1',
    endpoint: 'https://push.example.com/admin1',
    keys: { p256dh: 'k1', auth: 'a1' }
  });

  presenceService.recordHeartbeat(appId, {
    owner_type: 'admin',
    owner_id: 'admin_1',
    session_id: 'sess_admin_1',
    subscription_id: subAdmin1.id
  });

  const res1 = notificationService.processNotificationRequest(appId, {
    target: { type: 'admin', id: 'admin_1' },
    notification: { title: 'Test Admin Notification' }
  });

  assert.strictEqual(res1.accepted, 1);
  assert.strictEqual(res1.skipped_ineligible, 0);

  // --- Scenario 2: Logged out + Subscribed -> DO NOT SEND ---
  const subAdmin2 = subService.registerSubscription(appId, {
    owner_type: 'admin',
    owner_id: 'admin_2',
    endpoint: 'https://push.example.com/admin2',
    keys: { p256dh: 'k2', auth: 'a2' }
  });
  // Admin 2 has subscription, but NO presence!

  const res2 = notificationService.processNotificationRequest(appId, {
    target: { type: 'admin', id: 'admin_2' },
    notification: { title: 'Test Admin Notification 2' }
  });

  assert.strictEqual(res2.accepted, 0);
  assert.strictEqual(res2.skipped_ineligible, 1);

  // --- Scenario 3: Logged in + Not Subscribed -> DO NOT SEND ---
  presenceService.recordHeartbeat(appId, {
    owner_type: 'admin',
    owner_id: 'admin_3',
    session_id: 'sess_admin_3'
  });

  const res3 = notificationService.processNotificationRequest(appId, {
    target: { type: 'admin', id: 'admin_3' },
    notification: { title: 'Test Admin Notification 3' }
  });

  assert.strictEqual(res3.accepted, 0);
  assert.strictEqual(res3.skipped_ineligible, 0);

  // --- Scenario 4: Admin logs out -> Status transitions from eligible to ineligible ---
  // Logout Admin 1
  presenceService.recordLogout(appId, { session_id: 'sess_admin_1' });

  const res4 = notificationService.processNotificationRequest(appId, {
    target: { type: 'admin', id: 'admin_1' },
    notification: { title: 'Test Admin Notification After Logout' }
  });

  assert.strictEqual(res4.accepted, 0);
  assert.strictEqual(res4.skipped_ineligible, 1);

  db.close();
  console.log('✔ Admin Eligibility tests passed');
}

module.exports = testAdminEligibility;
