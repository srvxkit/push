const { loadEnv } = require('./config/env');
const { createDatabase } = require('./db/database');
const ApplicationRepository = require('./repositories/ApplicationRepository');
const SubscriptionRepository = require('./repositories/SubscriptionRepository');
const PresenceRepository = require('./repositories/PresenceRepository');
const DeliveryRepository = require('./repositories/DeliveryRepository');
const AuthService = require('./auth/AuthService');
const SubscriptionService = require('./subscriptions/SubscriptionService');
const PresenceService = require('./presence/PresenceService');
const NotificationService = require('./notifications/NotificationService');
const HealthController = require('./http/controllers/HealthController');
const SubscriptionController = require('./http/controllers/SubscriptionController');
const PresenceController = require('./http/controllers/PresenceController');
const NotificationController = require('./http/controllers/NotificationController');
const DashboardController = require('./http/controllers/DashboardController');
const Router = require('./http/router');
const { createServer } = require('./http/server');

function main() {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);

  // Repositories
  const applicationRepository = new ApplicationRepository(db);
  const subscriptionRepository = new SubscriptionRepository(db);
  const presenceRepository = new PresenceRepository(db);
  const deliveryRepository = new DeliveryRepository(db);

  // Services
  const authService = new AuthService(applicationRepository);
  const subscriptionService = new SubscriptionService(subscriptionRepository);
  const presenceService = new PresenceService(presenceRepository, env.PRESENCE_TTL_SECONDS);
  const notificationService = new NotificationService({
    subscriptionRepository,
    presenceRepository,
    deliveryRepository
  });

  // Controllers
  const healthController = new HealthController();
  const subscriptionController = new SubscriptionController(subscriptionService, authService, env.MAX_PAYLOAD_SIZE_BYTES);
  const presenceController = new PresenceController(presenceService, authService, env.MAX_PAYLOAD_SIZE_BYTES);
  const notificationController = new NotificationController(notificationService, authService, env.MAX_PAYLOAD_SIZE_BYTES);
  const dashboardController = new DashboardController(deliveryRepository);

  // Router
  const router = new Router({
    healthController,
    subscriptionController,
    presenceController,
    notificationController,
    dashboardController,
    env
  });

  // Server
  const server = createServer(router);

  server.listen(env.PORT, env.HOST, () => {
    console.log(`[Notification Server] Server running on http://${env.HOST}:${env.PORT}`);
    if (env.DASHBOARD_ENABLED) {
      console.log(`[Notification Server] Dashboard UI enabled on http://${env.HOST}:${env.PORT}${env.DASHBOARD_PATH}`);
    }
  });

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
