const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const rawPort = process.env.PORT;
const port = (rawPort && !isNaN(rawPort)) ? parseInt(rawPort, 10) : (rawPort || 3000);

const rawDashboardEnabled = process.env.DASHBOARD_ENABLED;
const dashboardEnabled = rawDashboardEnabled === undefined
  ? true
  : ['true', '1', 'yes'].includes(String(rawDashboardEnabled).toLowerCase().trim());

const config = {
  server: {
    port,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'production'
  },
  get webPush() {
    return {
      public: process.env.VAPID_PUBLIC_KEY || '',
      private: process.env.VAPID_PRIVATE_KEY || '',
      email: process.env.VAPID_SUBJECT || process.env.VAPID_EMAIL || 'mailto:admin@example.com'
    };
  },
  dashboard: {
    enabled: dashboardEnabled,
    path: process.env.DASHBOARD_PATH || '/dashboard'
  },
  maxPayloadSizeBytes: parseInt(process.env.MAX_PAYLOAD_SIZE_BYTES || '1048576', 10)
};

module.exports = config;
