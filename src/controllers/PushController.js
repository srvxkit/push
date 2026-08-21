const PushService = require('../services/PushService');
const NotificationLog = require('../models/NotificationLog');
const crypto = require('node:crypto');

class PushController {
  async getVapidKey(req, res) {
    const key = PushService.getPublicKey();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ publicKey: key }));
  }

  generateDeliveryId() {
    const ts = Math.floor(Date.now() / 1000);
    const rand = crypto.randomBytes(4).toString('hex');
    return `push_delv_${ts}_${rand}`;
  }

  async send(req, res) {
    const body = req.body || {};
    const { job_id, notification_id, idempotency_key, target, subscription, notification, payload } = body;

    const targetSub = subscription || body.subscription;
    const targetPayload = notification || payload || body.payload;

    if (!targetSub || !targetSub.endpoint) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        job_id: String(job_id || ''),
        error: 'INVALID_SUBSCRIPTION_PAYLOAD',
        message: 'Missing push subscription endpoint in payload'
      }));
    }

    const deliveryId = this.generateDeliveryId();
    const appId = req.application ? req.application.id : 'app_default';

    try {
      const result = await PushService.sendNotification(targetSub, targetPayload);

      if (result.success) {
        NotificationLog.log({
          id: deliveryId,
          applicationId: appId,
          jobId: job_id,
          notificationId: notification_id,
          idempotencyKey: idempotency_key,
          target,
          subscription: targetSub,
          notification: targetPayload,
          status: 'processed'
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          job_id: String(job_id || ''),
          delivery_id: deliveryId,
          status: 'processed'
        }));
      } else if (result.statusCode === 410 || result.statusCode === 404 || result.status === 'invalid_subscription') {
        NotificationLog.log({
          id: deliveryId,
          applicationId: appId,
          jobId: job_id,
          notificationId: notification_id,
          idempotencyKey: idempotency_key,
          target,
          subscription: targetSub,
          notification: targetPayload,
          status: 'invalid_subscription',
          lastError: result.error
        });

        res.writeHead(410, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          job_id: String(job_id || ''),
          error: 'INVALID_SUBSCRIPTION',
          message: 'Push subscription expired or revoked.'
        }));
      } else {
        NotificationLog.log({
          id: deliveryId,
          applicationId: appId,
          jobId: job_id,
          notificationId: notification_id,
          idempotencyKey: idempotency_key,
          target,
          subscription: targetSub,
          notification: targetPayload,
          status: 'failed',
          lastError: result.error
        });

        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: false,
          job_id: String(job_id || ''),
          error: 'SERVER_ERROR',
          message: result.error || 'Failed to send notification'
        }));
      }
    } catch (error) {
      const statusCode = (error.statusCode === 410 || error.statusCode === 404) ? 410 : 500;
      const errorCode = statusCode === 410 ? 'INVALID_SUBSCRIPTION' : 'SERVER_ERROR';
      const message = statusCode === 410 ? 'Push subscription expired or revoked.' : (error.message || 'Failed to send notification');

      NotificationLog.log({
        id: deliveryId,
        applicationId: appId,
        jobId: job_id,
        notificationId: notification_id,
        idempotencyKey: idempotency_key,
        target,
        subscription: targetSub,
        notification: targetPayload,
        status: statusCode === 410 ? 'invalid_subscription' : 'failed',
        lastError: message
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

  async broadcast(req, res) {
    const { subscriptions, payload } = req.body || {};
    if (!Array.isArray(subscriptions) || !payload) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'Missing subscriptions array or payload' }));
    }

    const result = await PushService.broadcast(subscriptions, payload);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...result }));
  }
}

module.exports = new PushController();
