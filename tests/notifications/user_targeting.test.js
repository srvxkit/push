const assert = require('node:assert');
const { createDatabase } = require('../../src/db/database');
const ApplicationRepository = require('../../src/repositories/ApplicationRepository');
const SubscriptionRepository = require('../../src/repositories/SubscriptionRepository');
const PresenceRepository = require('../../src/repositories/PresenceRepository');
const DeliveryRepository = require('../../src/repositories/DeliveryRepository');
const SubscriptionService = require('../../src/subscriptions/SubscriptionService');
const NotificationService = require('../../src/notifications/NotificationService');
const { ValidationError } = require('../../src/errors/AppError');

function testUserTargeting() {
  const db = createDatabase(':memory:');
  const appRepo = new ApplicationRepository(db);
  const subRepo = new SubscriptionRepository(db);
  const presenceRepo = new PresenceRepository(db);
  const deliveryRepo = new DeliveryRepository(db);

  const appId = 'app_user_test';
  appRepo.create({ id: appId, name: 'User Test App', apiKeyHash: 'hash_user' });

  const subService = new SubscriptionService(subRepo);
  const notificationService = new NotificationService({
    subscriptionRepository: subRepo,
    presenceRepository: presenceRepo,
    deliveryRepository: deliveryRepo
  });

  // 1. User with 3 devices
  subService.registerSubscription(appId, {
    owner_type: 'user',
    owner_id: 'user_42',
    endpoint: 'https://push.example.com/u42_desktop',
    keys: { p256dh: 'k1', auth: 'a1' }
  });
  subService.registerSubscription(appId, {
    owner_type: 'user',
    owner_id: 'user_42',
    endpoint: 'https://push.example.com/u42_phone',
    keys: { p256dh: 'k2', auth: 'a2' }
  });
  subService.registerSubscription(appId, {
    owner_type: 'user',
    owner_id: 'user_42',
    endpoint: 'https://push.example.com/u42_tablet',
    keys: { p256dh: 'k3', auth: 'a3' }
  });

  // User notifications do NOT require presence -> all 3 devices targeted
  const res1 = notificationService.processNotificationRequest(appId, {
    target: { type: 'user', id: 'user_42' },
    notification: { title: 'Order Update', body: 'Your order has shipped' }
  });

  assert.strictEqual(res1.accepted, 3);

  // 2. Batch users target ('users')
  subService.registerSubscription(appId, {
    owner_type: 'user',
    owner_id: 'user_99',
    endpoint: 'https://push.example.com/u99_desktop',
    keys: { p256dh: 'k4', auth: 'a4' }
  });

  const res2 = notificationService.processNotificationRequest(appId, {
    target: { type: 'users', ids: ['user_42', 'user_99', 'user_nonexistent'] },
    notification: { title: 'Broadcast Message' }
  });

  // 3 from user_42 + 1 from user_99 + 0 from user_nonexistent = 4
  assert.strictEqual(res2.accepted, 4);

  // 3. Reject invalid target type
  assert.throws(() => {
    notificationService.processNotificationRequest(appId, {
      target: { type: 'invalid_target', id: '1' },
      notification: { title: 'Hi' }
    });
  }, ValidationError);

  db.close();
  console.log('✔ User Targeting tests passed');
}

module.exports = testUserTargeting;
