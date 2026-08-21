const assert = require('node:assert');
const Router = require('../../src/http/router');

async function testCors() {
  const router = new Router({
    healthController: { getHealth: (req, res) => res.end('ok') },
    subscriptionController: {},
    presenceController: {},
    notificationController: {}
  });

  // Test 1: OPTIONS Preflight request
  let status = 0;
  let headers = {};
  let body = '';

  const reqOptions = {
    url: '/v1/subscriptions',
    method: 'OPTIONS',
    headers: { origin: 'http://localhost:5173', host: 'localhost:3000' }
  };

  const resOptions = {
    setHeader(key, value) { headers[key] = value; },
    writeHead(code) { status = code; },
    end(content) { body = content; }
  };

  await router.handleRequest(reqOptions, resOptions);

  assert.strictEqual(status, 204);
  assert.strictEqual(headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.strictEqual(headers['Access-Control-Allow-Methods'], 'GET, POST, PUT, DELETE, OPTIONS');
  assert.strictEqual(headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization, X-Requested-With');

  console.log('✔ CORS tests passed');
}

module.exports = testCors;
