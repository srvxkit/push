const testCI4Webhook = require('./webhook/webhook.test');

async function runAllTests() {
  console.log('==================================================');
  console.log('Running CI4 Web Push Server Test Suite...');
  console.log('==================================================\n');

  try {
    await testCI4Webhook();

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
