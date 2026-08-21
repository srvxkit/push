const { loadEnv } = require('../src/config/env');
const { createDatabase } = require('../src/db/database');
const DeliveryRepository = require('../src/repositories/DeliveryRepository');
const SubscriptionRepository = require('../src/repositories/SubscriptionRepository');
const WebPushService = require('../src/push/WebPushService');

class NotificationWorker {
  constructor({ db, deliveryRepository, subscriptionRepository, webPushService, maxRetries = 3, pollIntervalMs = 1000 }) {
    this.db = db;
    this.deliveryRepository = deliveryRepository;
    this.subscriptionRepository = subscriptionRepository;
    this.webPushService = webPushService;
    this.maxRetries = maxRetries;
    this.pollIntervalMs = pollIntervalMs;
    this.isRunning = false;
    this.timer = null;
  }

  start() {
    this.isRunning = true;
    this.deliveryRepository.resetProcessingToPending();
    this._poll();
  }

  async stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async _poll() {
    if (!this.isRunning) return;

    try {
      await this.processBatch();
    } catch (err) {
      console.error('[Worker Error]', err.message);
    } finally {
      if (this.isRunning) {
        this.timer = setTimeout(() => this._poll(), this.pollIntervalMs);
      }
    }
  }

  async processBatch(limit = 10) {
    const jobs = this.deliveryRepository.claimPendingJobs(limit);
    if (jobs.length === 0) return 0;

    for (const job of jobs) {
      await this.processJob(job);
    }

    return jobs.length;
  }

  async processJob(job) {
    // Verify subscription is active
    if (job.subscription_status !== 'active') {
      this.deliveryRepository.updateStatus(job.id, {
        status: 'expired',
        attempts: job.attempts + 1,
        lastError: 'Subscription is inactive or removed'
      });
      return;
    }

    const subscription = {
      endpoint: job.endpoint,
      p256dh: job.p256dh,
      auth: job.auth
    };

    const attempts = job.attempts + 1;

    try {
      const result = await this.webPushService.sendNotification(subscription, job.payload_json);

      if (result.success) {
        this.deliveryRepository.updateStatus(job.id, {
          status: 'sent',
          attempts,
          sentAt: new Date().toISOString()
        });
      } else if (result.status === 'invalid_subscription') {
        // Permanently invalid subscription -> mark subscription inactive!
        this.subscriptionRepository.updateStatus(job.subscription_id, 'inactive');
        this.deliveryRepository.updateStatus(job.id, {
          status: 'expired',
          attempts,
          lastError: `Permanent push error: ${result.error} (${result.statusCode})`
        });
      } else {
        // Transient error -> retry if attempts < maxRetries
        const newStatus = attempts >= this.maxRetries ? 'failed' : 'pending';
        this.deliveryRepository.updateStatus(job.id, {
          status: newStatus,
          attempts,
          lastError: `Transient push error: ${result.error} (${result.statusCode})`
        });
      }
    } catch (err) {
      const newStatus = attempts >= this.maxRetries ? 'failed' : 'pending';
      this.deliveryRepository.updateStatus(job.id, {
        status: newStatus,
        attempts,
        lastError: err.message || 'Worker processing error'
      });
    }
  }
}

// Standalone execution entry point
if (require.main === module) {
  const env = loadEnv();
  const db = createDatabase(env.DATABASE_PATH);
  const deliveryRepository = new DeliveryRepository(db);
  const subscriptionRepository = new SubscriptionRepository(db);
  const webPushService = new WebPushService(env);

  const worker = new NotificationWorker({
    db,
    deliveryRepository,
    subscriptionRepository,
    webPushService,
    maxRetries: env.MAX_RETRIES
  });

  worker.start();
  console.log('[Worker] Notification delivery worker started.');

  const shutdown = async () => {
    console.log('[Worker] Shutting down worker...');
    await worker.stop();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = NotificationWorker;
