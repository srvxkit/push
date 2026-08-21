const path = require('node:path');
const dotenv = require('dotenv');

let isLoaded = false;

function loadEnv() {
  if (!isLoaded) {
    dotenv.config({ path: path.resolve(process.cwd(), '.env') });
    isLoaded = true;
  }

  const rawPort = process.env.PORT;
  // Handle cPanel Passenger socket string 'passenger' or numeric port
  const port = (rawPort && !isNaN(rawPort)) ? parseInt(rawPort, 10) : (rawPort || 3000);

  const rawDashboardEnabled = process.env.DASHBOARD_ENABLED;
  const dashboardEnabled = rawDashboardEnabled === undefined
    ? true
    : ['true', '1', 'yes'].includes(String(rawDashboardEnabled).toLowerCase().trim());

  return {
    PORT: port,
    HOST: process.env.HOST || '0.0.0.0',
    NODE_ENV: process.env.NODE_ENV || 'production',
    DATABASE_PATH: process.env.DATABASE_PATH || './storage/push_server.json',
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
