const assert = require('node:assert');
const { createDatabase } = require('../../src/db/database');
const ApplicationRepository = require('../../src/repositories/ApplicationRepository');
const SubscriptionRepository = require('../../src/repositories/SubscriptionRepository');
const SubscriptionService = require('../../src/subscriptions/SubscriptionService');
const { ValidationError, NotFoundError } = require('../../src/errors/AppError');

function testSubscriptions() {
  const db = createDatabase(':memory:');
  const appRepo = new ApplicationRepository(db);
  const subRepo = new SubscriptionRepository(db);
  const subService = new SubscriptionService(subRepo);

  // Seed applications
  appRepo.create({ id: 'app_1', name: 'App One', apiKeyHash: 'hash_1' });
  appRepo.create({ id: 'app_2', name: 'App Two', apiKeyHash: 'hash_2' });

  // 1. Register subscription
  const sub1 = subService.registerSubscription('app_1', {
    owner_type: 'user',
    owner_id: 'user_100',
    device_id: 'device_desktop',
    endpoint: 'https://push.example.com/sub/1',
    keys: {
      p256dh: 'key_p256dh_1',
      auth: 'key_auth_1'
    }
  });

  assert.ok(sub1.id);
  assert.strictEqual(sub1.application_id, 'app_1');
  assert.strictEqual(sub1.owner_id, 'user_100');

  // 2. Register multiple devices for same user
  const sub2 = subService.registerSubscription('app_1', {
    owner_type: 'user',
    owner_id: 'user_100',
    device_id: 'device_mobile',
    endpoint: 'https://push.example.com/sub/2',
    keys: {
      p256dh: 'key_p256dh_2',
      auth: 'key_auth_2'
    }
  });

  const activeSubs = subService.getActiveSubscriptionsForOwner('app_1', 'user', 'user_100');
  assert.strictEqual(activeSubs.length, 2);

  // 3. Test listSubscriptions
  const allApp1Subs = subService.listSubscriptions('app_1');
  assert.strictEqual(allApp1Subs.length, 2);

  // 4. Test Cross-Application Isolation
  // App 2 should not see App 1's subscriptions
  const app2Subs = subService.getActiveSubscriptionsForOwner('app_2', 'user', 'user_100');
  assert.strictEqual(app2Subs.length, 0);

  const allApp2Subs = subService.listSubscriptions('app_2');
  assert.strictEqual(allApp2Subs.length, 0);

  // App 2 trying to delete App 1's subscription must fail
  assert.throws(() => {
    subService.removeSubscription('app_2', sub1.id);
  }, NotFoundError);

  // 5. Delete subscription as App 1
  const deleted = subService.removeSubscription('app_1', sub1.id);
  assert.strictEqual(deleted, true);

  const remainingSubs = subService.getActiveSubscriptionsForOwner('app_1', 'user', 'user_100');
  assert.strictEqual(remainingSubs.length, 1);
  assert.strictEqual(remainingSubs[0].id, sub2.id);

  // 6. Validation failure on invalid endpoint or missing keys
  assert.throws(() => {
    subService.registerSubscription('app_1', {
      owner_type: 'user',
      owner_id: 'user_100',
      endpoint: 'invalid-url',
      keys: { p256dh: 'a', auth: 'b' }
    });
  }, ValidationError);

  db.close();
  console.log('✔ Subscription tests passed');
}

module.exports = testSubscriptions;
