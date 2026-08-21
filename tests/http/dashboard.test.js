const assert = require('node:assert');
const { createDatabase } = require('../../src/db/database');
const DeliveryRepository = require('../../src/repositories/DeliveryRepository');
const DashboardController = require('../../src/http/controllers/DashboardController');
const Router = require('../../src/http/router');

async function testDashboard() {
  const db = createDatabase(':memory:');
  const deliveryRepo = new DeliveryRepository(db);
  const dashboardController = new DashboardController(deliveryRepo);

  // Test 1: Disabled Dashboard -> 404
  const disabledRouter = new Router({
    healthController: {},
    subscriptionController: {},
    presenceController: {},
    notificationController: {},
    dashboardController,
    env: { DASHBOARD_ENABLED: false, DASHBOARD_PATH: '/dashboard' }
  });

  let disabledStatus = 0;
  await disabledRouter.handleRequest(
    { url: '/dashboard', method: 'GET', headers: { host: 'localhost' } },
    { setHeader() {}, writeHead(code) { disabledStatus = code; }, end() {} }
  );

  assert.strictEqual(disabledStatus, 404);

  // Test 2: Enabled Dashboard -> 200 HTML
  const enabledRouter = new Router({
    healthController: {},
    subscriptionController: {},
    presenceController: {},
    notificationController: {},
    dashboardController,
    env: { DASHBOARD_ENABLED: true, DASHBOARD_PATH: '/dashboard' }
  });

  let enabledStatus = 0;
  let enabledBody = '';
  await enabledRouter.handleRequest(
    { url: '/dashboard', method: 'GET', headers: { host: 'localhost' } },
    { setHeader() {}, writeHead(code) { enabledStatus = code; }, end(content) { enabledBody = content; } }
  );

  assert.strictEqual(enabledStatus, 200);
  assert.ok(enabledBody.includes('Web Push Server Dashboard'));

  // Test 3: Stats JSON route
  let statsStatus = 0;
  let statsBody = '';
  await enabledRouter.handleRequest(
    { url: '/v1/stats', method: 'GET', headers: { host: 'localhost' } },
    { setHeader() {}, writeHead(code) { statsStatus = code; }, end(content) { statsBody = content; } }
  );

  assert.strictEqual(statsStatus, 200);
  const json = JSON.parse(statsBody);
  assert.ok(json.data.subscriptions);
  assert.ok(json.data.deliveries);

  db.close();
  console.log('✔ Dashboard tests passed');
}

module.exports = testDashboard;
