const { loadEnv } = require('./config/env');
const { createDatabase } = require('./db/database');
const ApplicationRepository = require('./repositories/ApplicationRepository');
const DeliveryRepository = require('./repositories/DeliveryRepository');
const WebPushService = require('./push/WebPushService');
const HealthController = require('./http/controllers/HealthController');
const DashboardController = require('./http/controllers/DashboardController');
const WebhookController = require('./http/controllers/WebhookController');
const createCryptoAuthMiddleware = require('./http/middleware/cryptoAuth');
const Router = require('./http/router');
const { createServer } = require('./http/server');

function main() {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);

  // Repositories
  const applicationRepository = new ApplicationRepository(db);
  const deliveryRepository = new DeliveryRepository(db);

  // Services
  const webPushService = new WebPushService(env);

  // Middleware
  const verifyRequest = createCryptoAuthMiddleware(applicationRepository);

  // Controllers
  const healthController = new HealthController();
  const dashboardController = new DashboardController(deliveryRepository);
  const webhookController = new WebhookController(
    webPushService,
    deliveryRepository,
    verifyRequest,
    env.MAX_PAYLOAD_SIZE_BYTES
  );

  // Router
  const router = new Router({
    healthController,
    webhookController,
    dashboardController,
    env
  });

  // Server
  const server = createServer(router);

  // cPanel Passenger socket vs Standard TCP port listener
  if (typeof env.PORT === 'string' && (env.PORT === 'passenger' || env.PORT.startsWith('/') || env.PORT.startsWith('\\\\'))) {
    server.listen(env.PORT, () => {
      console.log(`[Notification Server] Server running on cPanel Passenger socket: ${env.PORT}`);
    });
  } else {
    server.listen(env.PORT, env.HOST, () => {
      console.log(`[Notification Server] Server running on http://${env.HOST}:${env.PORT}`);
      if (env.DASHBOARD_ENABLED) {
        console.log(`[Notification Server] Dashboard UI enabled on http://${env.HOST}:${env.PORT}${env.DASHBOARD_PATH}`);
      }
    });
  }

  const shutdown = () => {
    console.log('[Notification Server] Shutting down HTTP server...');
    server.close(() => {
      db.close();
      console.log('[Notification Server] Database connection closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main();
}

module.exports = { main };
