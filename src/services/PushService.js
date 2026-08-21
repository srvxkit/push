const webPush = require('web-push');
const config = require('../config');

class PushService {
  constructor() {
    if (config.webPush.public && config.webPush.private) {
      webPush.setVapidDetails(
        config.webPush.email,
        config.webPush.public,
        config.webPush.private
      );
    }
  }

  getPublicKey() {
    return config.webPush.public;
  }

  async sendNotification(subscription, payload) {
    if (!subscription || !subscription.endpoint) {
      throw new Error('Invalid subscription object: Missing endpoint');
    }

    // Normalize subscription format for web-push
    const normalizedSub = {
      endpoint: subscription.endpoint,
      keys: subscription.keys || {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };

    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload || {});

    try {
      const res = await webPush.sendNotification(normalizedSub, payloadString);
      return { success: true, statusCode: res.statusCode || 201 };
    } catch (err) {
      const statusCode = err.statusCode || 500;
      const isInvalid = statusCode === 410 || statusCode === 404;

      return {
        success: false,
        statusCode,
        status: isInvalid ? 'invalid_subscription' : 'failed',
        error: err.message || 'Web push delivery failed'
      };
    }
  }

  async broadcast(subscriptions, payload) {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return { successful: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map(sub => this.sendNotification(sub, payload))
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value && r.value.success).length;
    const failed = results.length - successful;

    return { successful, failed };
  }
}

module.exports = new PushService();
module.exports.PushService = PushService;
