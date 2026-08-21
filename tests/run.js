const testAuth = require('./auth/auth.test');
const testSubscriptions = require('./subscriptions/subscription.test');
const testPresence = require('./presence/presence.test');
const testAdminEligibility = require('./notifications/admin_eligibility.test');
const testUserTargeting = require('./notifications/user_targeting.test');
const testWorker = require('./worker/worker.test');
const testCors = require('./http/cors.test');
const testDashboard = require('./http/dashboard.test');
const testFallbackAdapter = require('./db/fallback.test');

async function runAllTests() {
  console.log('==================================================');
  console.log('Running Centralized Web Push Server Test Suite...');
  console.log('==================================================\n');

  try {
    testAuth();
    testSubscriptions();
    testPresence();
    testAdminEligibility();
    testUserTargeting();
    await testCors();
    await testDashboard();
    testFallbackAdapter();
    await testWorker();

    console.log('\n--------------------------------------------------');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('\n❌ TEST FAILURE:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runAllTests();
}

module.exports = runAllTests;
