const crypto = require('node:crypto');
const { ValidationError } = require('../errors/AppError');

class NotificationService {
  constructor({ subscriptionRepository, presenceRepository, deliveryRepository }) {
    this.subscriptionRepository = subscriptionRepository;
    this.presenceRepository = presenceRepository;
    this.deliveryRepository = deliveryRepository;
  }

  processNotificationRequest(applicationId, requestBody) {
    const { target, notification, idempotency_key } = requestBody || {};

    if (!target || !target.type) {
      throw new ValidationError('Target object with type is required', 'INVALID_TARGET');
    }

    if (!notification || !notification.title) {
      throw new ValidationError('Notification payload with at least title is required', 'INVALID_NOTIFICATION');
    }

    const targetType = target.type.toLowerCase();
    const allowedTargets = ['admin', 'user', 'admins', 'users'];

    if (!allowedTargets.includes(targetType)) {
      throw new ValidationError(`Unsupported target type: ${target.type}`, 'INVALID_TARGET');
    }

    const notificationId = 'notif_' + crypto.randomBytes(12).toString('hex');
    const createdJobs = [];
    const skippedIneligible = [];

    // Resolve owner list based on target type
    const ownerTargets = this._resolveOwnerTargets(target);

    for (const { ownerType, ownerId } of ownerTargets) {
      // Find active subscriptions for this owner
      const activeSubscriptions = this.subscriptionRepository.findActiveByOwner(applicationId, ownerType, ownerId);

      for (const subscription of activeSubscriptions) {
        // Admin Rule: active subscription AND active presence
        if (ownerType === 'admin') {
          const isPresenceActive = this.presenceRepository.hasActivePresenceForSubscription(
            applicationId,
            subscription.id,
            ownerType,
            ownerId
          );

          if (!isPresenceActive) {
            skippedIneligible.push({
              subscription_id: subscription.id,
              owner_id: ownerId,
              reason: 'Admin subscription present but no active logged-in presence'
            });
            continue;
          }
        }

        // Target is eligible! Create delivery job
        const deliveryId = 'del_' + crypto.randomBytes(12).toString('hex');
        const payloadJson = JSON.stringify({
          notification_id: notificationId,
          title: notification.title,
          body: notification.body || '',
          url: notification.url || '/',
          icon: notification.icon || null,
          data: notification.data || {},
          type: notification.type || 'default'
        });

        const jobKey = idempotency_key ? `${idempotency_key}_${subscription.id}` : null;

        const job = this.deliveryRepository.create({
          id: deliveryId,
          applicationId,
          notificationId,
          subscriptionId: subscription.id,
          ownerType,
          ownerId,
          payloadJson,
          idempotencyKey: jobKey
        });

        if (job) {
          createdJobs.push(job);
        }
      }
    }

    return {
      notification_id: notificationId,
      accepted: createdJobs.length,
      skipped_ineligible: skippedIneligible.length,
      deliveries: createdJobs.map(j => ({ id: j.id, subscription_id: j.subscription_id, status: j.status }))
    };
  }

  _resolveOwnerTargets(target) {
    const type = target.type.toLowerCase();
    const targets = [];

    if (type === 'admin') {
      if (target.id === undefined || target.id === null) {
        throw new ValidationError('target.id is required for single admin target', 'INVALID_TARGET');
      }
      targets.push({ ownerType: 'admin', ownerId: String(target.id) });
    } else if (type === 'user') {
      if (target.id === undefined || target.id === null) {
        throw new ValidationError('target.id is required for single user target', 'INVALID_TARGET');
      }
      targets.push({ ownerType: 'user', ownerId: String(target.id) });
    } else if (type === 'admins') {
      if (!Array.isArray(target.ids) || target.ids.length === 0) {
        throw new ValidationError('target.ids array is required for admins target', 'INVALID_TARGET');
      }
      target.ids.forEach(id => targets.push({ ownerType: 'admin', ownerId: String(id) }));
    } else if (type === 'users') {
      if (!Array.isArray(target.ids) || target.ids.length === 0) {
        throw new ValidationError('target.ids array is required for users target', 'INVALID_TARGET');
      }
      target.ids.forEach(id => targets.push({ ownerType: 'user', ownerId: String(id) }));
    }

    return targets;
  }
}

module.exports = NotificationService;
