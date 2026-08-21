const { readJsonBody } = require('../middleware/bodyParser');
const crypto = require('node:crypto');

class WebhookController {
  constructor(webPushService, deliveryRepository, verifyRequest, maxPayloadSize) {
    this.webPushService = webPushService;
    this.deliveryRepository = deliveryRepository;
    this.verifyRequest = verifyRequest;
    this.maxPayloadSize = maxPayloadSize;
  }

  generateDeliveryId() {
    const ts = Math.floor(Date.now() / 1000);
    const rand = crypto.randomBytes(4).toString('hex');
    return `push_delv_${ts}_${rand}`;
  }

  async send(req, res) {
    // Verify Request Credentials
    const authResult = this.verifyRequest(req);
    if (!authResult.success) {
      res.writeHead(authResult.error.statusCode, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: authResult.error.errorCode,
        message: authResult.error.message
      }));
    }

    const app = authResult.application;

    let body;
    try {
      body = await readJsonBody(req, this.maxPayloadSize);
    } catch (err) {
      res.writeHead(err.statusCode || 400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: err.errorCode || 'INVALID_INPUT',
        message: err.message
      }));
    }

    const { job_id, notification_id, idempotency_key, target, subscription, notification } = body;

    const endpoint = subscription ? subscription.endpoint : null;
    const p256dh = subscription ? (subscription.keys ? subscription.keys.p256dh : subscription.p256dh) : null;
    const auth = subscription ? (subscription.keys ? subscription.keys.auth : subscription.auth) : null;

    if (!endpoint || !p256dh || !auth) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        job_id: String(job_id || ''),
        error: 'INVALID_SUBSCRIPTION_PAYLOAD',
        message: 'Missing push subscription endpoint or keys in payload'
      }));
    }

    const normalizedSubscription = {
      endpoint,
      keys: { p256dh, auth },
      p256dh,
      auth
    };

    const deliveryId = this.generateDeliveryId();
    const notificationPayload = typeof notification === 'string' ? notification : JSON.stringify(notification || {});

    try {
      const result = await this.webPushService.sendNotification(normalizedSubscription, notificationPayload);

      if (result.success) {
        this.deliveryRepository.create({
          id: deliveryId,
          applicationId: app.id,
          jobId: job_id,
          notificationId: notification_id,
          idempotencyKey: idempotency_key,
          target,
          subscription: normalizedSubscription,
          notification,
          status: 'processed',
          deliveryId
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          job_id: String(job_id || ''),
          delivery_id: deliveryId,
          status: 'processed'
        }));
      } else if (result.statusCode === 410 || result.statusCode === 404 || result.status === 'invalid_subscription') {
        this.deliveryRepository.create({
          id: deliveryId,
          applicationId: app.id,
          jobId: job_id,
          notificationId: notification_id,
          idempotencyKey: idempotency_key,
          target,
          subscription: normalizedSubscription,
          notification,
          status: 'invalid_subscription',
          lastError: result.error,
          deliveryId
        });

        res.writeHead(410, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          job_id: String(job_id || ''),
          error: 'INVALID_SUBSCRIPTION',
          message: 'Push subscription expired or revoked.'
        }));
      } else {
        this.deliveryRepository.create({
          id: deliveryId,
          applicationId: app.id,
          jobId: job_id,
          notificationId: notification_id,
          idempotencyKey: idempotency_key,
          target,
          subscription: normalizedSubscription,
          notification,
          status: 'failed',
          lastError: result.error,
          deliveryId
        });

        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          job_id: String(job_id || ''),
          error: 'SERVER_ERROR',
          message: result.error || 'Failed to deliver web push notification'
        }));
      }
    } catch (err) {
      const statusCode = (err.statusCode === 410 || err.statusCode === 404) ? 410 : 500;
      const errorCode = statusCode === 410 ? 'INVALID_SUBSCRIPTION' : 'SERVER_ERROR';
      const message = statusCode === 410 ? 'Push subscription expired or revoked.' : (err.message || 'Push delivery error');

      this.deliveryRepository.create({
        id: deliveryId,
        applicationId: app.id,
        jobId: job_id,
        notificationId: notification_id,
        idempotencyKey: idempotency_key,
        target,
        subscription: normalizedSubscription,
        notification,
        status: statusCode === 410 ? 'invalid_subscription' : 'failed',
        lastError: message,
        deliveryId
      });

      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        job_id: String(job_id || ''),
        error: errorCode,
        message
      }));
    }
  }
}

module.exports = WebhookController;
