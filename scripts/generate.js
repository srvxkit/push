const webPush = require('web-push');

function main() {
  const args = process.argv.slice(2);
  const isVapid = args.includes('--vapid') || args.length === 0;

  if (isVapid) {
    const vapidKeys = webPush.generateVAPIDKeys();

    console.log('========================================================================================');
    console.log('🔑 Web Push VAPID Keypair Generated Successfully!');
    console.log('========================================================================================');
    console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
    console.log('----------------------------------------------------------------------------------------');
    console.log('Add these key values into your .env file:');
    console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
    console.log(`VAPID_SUBJECT=mailto:admin@example.com`);
    console.log('========================================================================================');
  } else {
    console.log('Usage: npm run generate -- --vapid');
  }
}

if (require.main === module) {
  main();
}
