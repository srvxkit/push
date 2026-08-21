const path = require('node:path');
const dotenv = require('dotenv');

let isLoaded = false;

function loadEnv() {
  if (!isLoaded) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    isLoaded = true;
  }

  const rawDashboardEnabled = process.env.DASHBOARD_ENABLED;
  const dashboardEnabled = rawDashboardEnabled === undefined
    ? true // Default to enabled if not set
    : ['true', '1', 'yes'].includes(String(rawDashboardEnabled).toLowerCase().trim());

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    HOST: process.env.HOST || '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_PATH: process.env.DATABASE_PATH || './storage/push_server.db',
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || '',
    VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    PRESENCE_TTL_SECONDS: parseInt(process.env.PRESENCE_TTL_SECONDS || '300', 10),
    MAX_PAYLOAD_SIZE_BYTES: parseInt(process.env.MAX_PAYLOAD_SIZE_BYTES || '1048576', 10),
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3', 10),
    DASHBOARD_ENABLED: dashboardEnabled,
    DASHBOARD_PATH: process.env.DASHBOARD_PATH || '/dashboard'
  };
}

module.exports = {
  loadEnv
};
