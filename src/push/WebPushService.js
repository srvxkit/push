const webPush = require('web-push');

class WebPushService {
  constructor(config = {}) {
    this.vapidPublicKey = config.VAPID_PUBLIC_KEY || '';
    this.vapidPrivateKey = config.VAPID_PRIVATE_KEY || '';
    this.vapidSubject = config.VAPID_SUBJECT || 'mailto:admin@example.com';

    if (this.vapidPublicKey && this.vapidPrivateKey) {
      webPush.setVapidDetails(
        this.vapidSubject,
        this.vapidPublicKey,
        this.vapidPrivateKey
      );
    }
  }

  async sendNotification(subscription, payloadString) {
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };

    try {
      const response = await webPush.sendNotification(pushSubscription, payloadString);
      return {
        success: true,
        statusCode: response.statusCode,
        status: 'sent'
      };
    } catch (error) {
      const statusCode = error.statusCode || 500;
      const isPermanent = statusCode === 404 || statusCode === 410;

      return {
        success: false,
        statusCode,
        status: isPermanent ? 'invalid_subscription' : 'transient_failure',
        error: error.message || 'Push delivery failed'
      };
    }
  }
}

module.exports = WebPushService;
