const { loadEnv } = require('../src/config/env');
const { createDatabase } = require('../src/db/database');
const SubscriptionRepository = require('../src/repositories/SubscriptionRepository');

function main() {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);
  const subRepo = new SubscriptionRepository(db);

  const subscriptions = subRepo.findAll();

  console.log('========================================================================================');
  console.log('📋 Registered Web Push Subscriptions');
  console.log('========================================================================================');

  if (subscriptions.length === 0) {
    console.log('No subscriptions found in database.');
  } else {
    subscriptions.forEach((sub, i) => {
      console.log(`[${i + 1}] ID        : ${sub.id}`);
      console.log(`    App       : ${sub.application_name || sub.application_id}`);
      console.log(`    Owner     : ${sub.owner_type} (${sub.owner_id})`);
      console.log(`    Device    : ${sub.device_id || 'N/A'}`);
      console.log(`    Status    : ${sub.status}`);
      console.log(`    Endpoint  : ${sub.endpoint.substring(0, 60)}...`);
      console.log(`    Created   : ${sub.created_at}`);
      console.log('----------------------------------------------------------------------------------------');
    });
  }

  console.log(`Total Subscriptions: ${subscriptions.length}`);
  console.log('========================================================================================');

  db.close();
}

if (require.main === module) {
  main();
}
