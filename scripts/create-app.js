const crypto = require('node:crypto');
const { loadEnv } = require('../src/config/env');
const { createDatabase } = require('../src/db/database');
const ApplicationRepository = require('../src/repositories/ApplicationRepository');
const AuthService = require('../src/auth/AuthService');

function main() {
  const args = process.argv.slice(2);
  let name = '';
  let apiKey = '';
  let id = '';
  let isList = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) name = args[i + 1];
    if (args[i] === '--token' && args[i + 1]) apiKey = args[i + 1];
    if (args[i] === '--id' && args[i + 1]) id = args[i + 1];
    if (args[i] === '--list') isList = true;
  }

  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);
  const appRepo = new ApplicationRepository(db);
  const authService = new AuthService(appRepo);

  // Listing applications
  if (isList) {
    const apps = appRepo.findAll();
    console.log('==================================================');
    console.log('📋 Registered Applications');
    console.log('==================================================');
    if (apps.length === 0) {
      console.log('No applications registered yet.');
    } else {
      apps.forEach(app => {
        console.log(`ID: ${app.id} | Name: ${app.name} | Status: ${app.status} | Created: ${app.created_at}`);
      });
    }
    console.log('==================================================');
    db.close();
    return;
  }

  if (!name) {
    name = 'Primary Application';
  }

  if (!apiKey) {
    apiKey = 'app_token_' + crypto.randomBytes(16).toString('hex');
  }

  const existingApp = appRepo.findByName(name);

  if (existingApp) {
    // App exists -> update token!
    const tokenHash = authService.hashToken(apiKey);
    appRepo.updateApiKeyHash(existingApp.id, tokenHash);

    console.log('==================================================');
    console.log('🔄 Application Token Reset / Updated Successfully!');
    console.log('==================================================');
    console.log(`Application ID  : ${existingApp.id}`);
    console.log(`Application Name: ${existingApp.name}`);
    console.log(`NEW API Token   : ${apiKey}`);
    console.log('--------------------------------------------------');
    console.log('Use this header in your HTTP requests:');
    console.log(`Authorization: Bearer ${apiKey}`);
    console.log('==================================================');
  } else {
    // Create new app
    if (!id) {
      id = 'app_' + crypto.randomBytes(8).toString('hex');
    }
    const app = authService.registerApplication({
      id,
      name,
      apiKey
    });

    console.log('==================================================');
    console.log('🎉 Application Credentials Created Successfully!');
    console.log('==================================================');
    console.log(`Application ID  : ${app.id}`);
    console.log(`Application Name: ${app.name}`);
    console.log(`API Token       : ${apiKey}`);
    console.log('--------------------------------------------------');
    console.log('Use this header in your HTTP requests:');
    console.log(`Authorization: Bearer ${apiKey}`);
    console.log('==================================================');
  }

  db.close();
}

if (require.main === module) {
  main();
}
