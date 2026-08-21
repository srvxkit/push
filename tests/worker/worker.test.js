const assert = require('node:assert');
const { createDatabase } = require('../../src/db/database');
const ApplicationRepository = require('../../src/repositories/ApplicationRepository');
const DeliveryRepository = require('../../src/repositories/DeliveryRepository');
const SubscriptionRepository = require('../../src/repositories/SubscriptionRepository');
const NotificationWorker = require('../../worker/notification-worker');

async function testWorker() {
  const db = createDatabase(':memory:');
  const appRepo = new ApplicationRepository(db);
  const deliveryRepo = new DeliveryRepository(db);
  const subRepo = new SubscriptionRepository(db);

  // Seed application & subscription
  appRepo.create({
    id: 'app_w',
    name: 'Worker App',
    apiKeyHash: 'hash_w'
  });

  const subActive = subRepo.upsert({
    id: 'sub_active',
    applicationId: 'app_w',
    ownerType: 'user',
    ownerId: 'u1',
    endpoint: 'https://push.example.com/ok',
    p256dh: 'p1',
    auth: 'a1'
  });

  const subInvalid = subRepo.upsert({
    id: 'sub_invalid',
    applicationId: 'app_w',
    ownerType: 'user',
    ownerId: 'u2',
    endpoint: 'https://push.example.com/invalid_410',
    p256dh: 'p2',
    auth: 'a2'
  });

  // Seed pending delivery jobs
  deliveryRepo.create({
    id: 'del_1',
    applicationId: 'app_w',
    notificationId: 'notif_1',
    subscriptionId: subActive.id,
    ownerType: 'user',
    ownerId: 'u1',
    payloadJson: JSON.stringify({ title: 'Test 1' })
  });

  deliveryRepo.create({
    id: 'del_2',
    applicationId: 'app_w',
    notificationId: 'notif_2',
    subscriptionId: subInvalid.id,
    ownerType: 'user',
    ownerId: 'u2',
    payloadJson: JSON.stringify({ title: 'Test 2' })
  });

  // Mock WebPushService
  const mockWebPushService = {
    sendNotification: async (sub) => {
      if (sub.endpoint.includes('invalid_410')) {
        return {
          success: false,
          statusCode: 410,
          status: 'invalid_subscription',
          error: 'Push subscription has expired or is invalid'
        };
      }
      return {
        success: true,
        statusCode: 201,
        status: 'sent'
      };
    }
  };

  const worker = new NotificationWorker({
    db,
    deliveryRepository: deliveryRepo,
    subscriptionRepository: subRepo,
    webPushService: mockWebPushService,
    maxRetries: 3
  });

  // Process batch
  const count = await worker.processBatch(10);
  assert.strictEqual(count, 2);

  // Check job 1 status (sent)
  const job1 = deliveryRepo.findById('del_1');
  assert.strictEqual(job1.status, 'sent');
  assert.ok(job1.sent_at);

  // Check job 2 status (expired)
  const job2 = deliveryRepo.findById('del_2');
  assert.strictEqual(job2.status, 'expired');

  // Check subInvalid status in database -> must be marked 'inactive'!
  const updatedSubInvalid = subRepo.findById('app_w', subInvalid.id);
  assert.strictEqual(updatedSubInvalid.status, 'inactive');

  db.close();
  console.log('✔ Worker tests passed');
}

module.exports = testWorker;
