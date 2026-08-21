const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const ApiKey = require('../../src/models/ApiKey');
const NotificationLog = require('../../src/models/NotificationLog');
const PushService = require('../../src/services/PushService');
const Server = require('../../server');

function makeRequest(server, options, postData) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const reqOptions = {
      hostname: '127.0.0.1',
      port: address.port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data, json });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function testOptionAArchitecture() {
  // 1. Verify SHA-256 Hashed Key Storage Security & Unique Name Enforcement
  const rawKey = 'secret_ci4_key_999';
  ApiKey.save({
    id: 'app_test_999',
    name: 'CI4 App Unique Test',
    key: rawKey
  });

  // Verify duplicate name throws error
  assert.throws(() => {
    ApiKey.save({
      id: 'app_test_duplicate',
      name: 'CI4 App Unique Test',
      key: 'some_other_key'
    });
  }, /already exists/i, 'Duplicate application name MUST throw unique name error');

  const storedKeys = ApiKey.getAll();
  const createdApp = storedKeys.find(k => k.id === 'app_test_999');
  assert.ok(createdApp, 'App should be present in store');
  assert.strictEqual(createdApp.key, undefined, 'Plaintext key MUST NOT be stored');
  assert.strictEqual(createdApp.keyHash, ApiKey.hashKey(rawKey));

  // Mock PushService.sendNotification
  const originalSend = PushService.sendNotification;
  PushService.sendNotification = async (sub, payload) => {
    if (sub.endpoint && sub.endpoint.includes('expired_410')) {
      return { success: false, statusCode: 410, status: 'invalid_subscription', error: 'Push subscription expired' };
    }
    if (sub.endpoint && sub.endpoint.includes('error_500')) {
      return { success: false, statusCode: 500, status: 'failed', error: 'Server push error' };
    }
    return { success: true, statusCode: 200, status: 'sent' };
  };

  // Start test server
  const serverInstance = new Server();
  const server = serverInstance.server;

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    // 2. Test Public GET /health
    const healthRes = await makeRequest(server, { path: '/health', method: 'GET' });
    assert.strictEqual(healthRes.statusCode, 200);
    assert.strictEqual(healthRes.json.status, 'ok');

    // 3. Test Public GET /api/vapid-public-key
    const vapidRes = await makeRequest(server, { path: '/api/vapid-public-key', method: 'GET' });
    assert.strictEqual(vapidRes.statusCode, 200);
    assert.ok(vapidRes.json.hasOwnProperty('publicKey'));

    // 4. Test Webhook POST without auth header -> 401
    const unauthRes = await makeRequest(server, { path: '/v1/notifications/send', method: 'POST' }, { job_id: '100' });
    assert.strictEqual(unauthRes.statusCode, 401);
    assert.strictEqual(unauthRes.json.success, false);

    // 5. Test Webhook POST with invalid key -> 401
    const invalidRes = await makeRequest(server, {
      path: '/v1/notifications/send',
      method: 'POST',
      headers: { 'x-api-key': 'wrong_key' }
    }, { job_id: '100' });
    assert.strictEqual(invalidRes.statusCode, 401);

    // 6. Test Valid Webhook Dispatch via Authorization Bearer header -> 200 OK
    const successRes = await makeRequest(server, {
      path: '/v1/notifications/send',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${rawKey}` }
    }, {
      job_id: '101',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/ok_endpoint',
        keys: { p256dh: 'p256', auth: 'auth' }
      },
      notification: { title: 'Test Title', body: 'Test Body' }
    });

    assert.strictEqual(successRes.statusCode, 200);
    assert.strictEqual(successRes.json.success, true);
    assert.strictEqual(successRes.json.job_id, '101');
    assert.ok(successRes.json.delivery_id.startsWith('push_delv_'));
    assert.strictEqual(successRes.json.status, 'processed');

    // 7. Test Valid Webhook Dispatch via x-api-key header (Expired 410 Gone)
    const expiredRes = await makeRequest(server, {
      path: '/api/send-notification',
      method: 'POST',
      headers: { 'x-api-key': rawKey }
    }, {
      job_id: '102',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/expired_410',
        keys: { p256dh: 'p256', auth: 'auth' }
      },
      notification: { title: 'Expired Test' }
    });

    assert.strictEqual(expiredRes.statusCode, 410);
    assert.strictEqual(expiredRes.json.success, false);
    assert.strictEqual(expiredRes.json.job_id, '102');
    assert.strictEqual(expiredRes.json.error, 'INVALID_SUBSCRIPTION');

    // 8. Test Server Transient Error 500
    const errorRes = await makeRequest(server, {
      path: '/webhook/send',
      method: 'POST',
      headers: { 'Authorization': `Bearer ${rawKey}` }
    }, {
      job_id: '103',
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/error_500',
        keys: { p256dh: 'p256', auth: 'auth' }
      },
      notification: { title: 'Error Test' }
    });

    assert.strictEqual(errorRes.statusCode, 500);
    assert.strictEqual(errorRes.json.success, false);
    assert.strictEqual(errorRes.json.job_id, '103');

    // 9. Test POST /v1/applications Creation API Endpoint
    const createAppRes = await makeRequest(server, {
      path: '/v1/applications',
      method: 'POST'
    }, { name: 'Dashboard Test App' });

    assert.strictEqual(createAppRes.statusCode, 201);
    assert.strictEqual(createAppRes.json.success, true);
    assert.strictEqual(createAppRes.json.application.name, 'Dashboard Test App');
    assert.ok(createAppRes.json.application.apiKey.startsWith('app_key_'));

    // Duplicate creation check
    const dupAppRes = await makeRequest(server, {
      path: '/v1/applications',
      method: 'POST'
    }, { name: 'Dashboard Test App' });

    assert.strictEqual(dupAppRes.statusCode, 400);
    assert.strictEqual(dupAppRes.json.success, false);
    assert.strictEqual(dupAppRes.json.error, 'DUPLICATE_NAME');

  } finally {
    PushService.sendNotification = originalSend;
    ApiKey.delete('app_test_999');
    ApiKey.delete('Dashboard Test App');
    server.close();
  }

  console.log('✔ Dashboard application creation API & Option A tests passed');
}

module.exports = testOptionAArchitecture;
