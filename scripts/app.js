const crypto = require('node:crypto');
const apiKeyModel = require('../src/models/ApiKey');

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    create: false,
    list: false,
    name: null,
    token: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--create') {
      flags.create = true;
    } else if (arg === '--list') {
      flags.list = true;
    } else if (arg === '--name' && i + 1 < args.length) {
      flags.name = args[i + 1];
      i++;
    } else if (arg === '--token' && i + 1 < args.length) {
      flags.token = args[i + 1];
      i++;
    }
  }

  return flags;
}

function generateRandomToken() {
  return `app_key_${crypto.randomBytes(24).toString('hex')}`;
}

function main() {
  const flags = parseArgs();

  if (flags.create) {
    if (!flags.name) {
      console.error('❌ Error: --name argument is required when creating an application.');
      console.error('Usage: npm run app -- --create --name "My Application"');
      process.exit(1);
    }

    const name = flags.name.trim();
    const rawKey = flags.token ? flags.token.trim() : generateRandomToken();

    try {
      apiKeyModel.save({
        name,
        key: rawKey,
        owner: name
      });
    } catch (err) {
      console.error(`\n❌ Application Creation Failed: ${err.message}`);
      console.error('Please choose a different, unique application name.\n');
      process.exit(1);
    }

    console.log('\n========================================================================================');
    console.log('🎉 Application API Key Created Successfully!');
    console.log('========================================================================================');
    console.log(`Application Name: ${name}`);
    console.log(`API Key (RAW)   : ${rawKey}`);
    console.log('----------------------------------------------------------------------------------------');
    console.log('🔒 Security Notice: The raw API key is displayed ONLY ONCE above.');
    console.log('Only its SHA-256 cryptographic hash has been saved to data/api-keys.json.');
    console.log('----------------------------------------------------------------------------------------');
    console.log('Pass this key in your HTTP request headers to Node.js:');
    console.log(`Authorization: Bearer ${rawKey}`);
    console.log('Or:');
    console.log(`x-api-key: ${rawKey}`);
    console.log('========================================================================================\n');
    return;
  }

  if (flags.list) {
    const keys = apiKeyModel.getAll();

    console.log('\n========================================================================================');
    console.log('📋 Registered Applications (SHA-256 Hashed Keys)');
    console.log('========================================================================================');

    if (keys.length === 0) {
      console.log('No applications registered yet.');
      console.log('Run: npm run app -- --create --name "My Application"');
    } else {
      keys.forEach((a, i) => {
        console.log(`${i + 1}. [${a.id}] ${a.name || a.owner}`);
        console.log(`   Active        : ${a.active ? 'Yes' : 'No'}`);
        console.log(`   SHA-256 Hash  : ${a.keyHash}`);
        console.log(`   Created At    : ${a.createdAt}`);
        console.log('----------------------------------------------------------------------------------------');
      });
    }

    console.log('========================================================================================\n');
    return;
  }

  console.log('\n========================================================================================');
  console.log('🛠 Application Management CLI');
  console.log('========================================================================================');
  console.log('Usage:');
  console.log('  npm run app -- --create --name "My Application"');
  console.log('  npm run app -- --create --name "My Application" --token "custom_secret_key"');
  console.log('  npm run app -- --list');
  console.log('========================================================================================\n');
}

main();
