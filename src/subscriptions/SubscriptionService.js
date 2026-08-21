const crypto = require('node:crypto');
const { ValidationError, NotFoundError } = require('../errors/AppError');

class SubscriptionService {
  constructor(subscriptionRepository) {
    this.subscriptionRepository = subscriptionRepository;
  }

  registerSubscription(applicationId, payload) {
    const { owner_type, owner_id, device_id, endpoint, keys } = payload || {};

    if (!owner_type || !['admin', 'user'].includes(owner_type.toLowerCase())) {
      throw new ValidationError('owner_type must be either "admin" or "user"');
    }

    if (owner_id === undefined || owner_id === null || String(owner_id).trim() === '') {
      throw new ValidationError('owner_id is required');
    }

    if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('http')) {
      throw new ValidationError('Valid HTTP/HTTPS subscription endpoint is required');
    }

    if (!keys || !keys.p256dh || !keys.auth) {
      throw new ValidationError('Subscription keys object containing p256dh and auth is required');
    }

    const id = 'sub_' + crypto.randomBytes(12).toString('hex');

    return this.subscriptionRepository.upsert({
      id,
      applicationId,
      ownerType: owner_type.toLowerCase(),
      ownerId: owner_id,
      deviceId: device_id || null,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      status: 'active'
    });
  }

  listSubscriptions(applicationId, filters = {}) {
    return this.subscriptionRepository.findAllByApplication(applicationId, filters);
  }

  removeSubscription(applicationId, subscriptionId) {
    const existing = this.subscriptionRepository.findById(applicationId, subscriptionId);
    if (!existing) {
      throw new NotFoundError('Subscription not found');
    }
    return this.subscriptionRepository.delete(applicationId, subscriptionId);
  }

  deactivateSubscription(subscriptionId) {
    this.subscriptionRepository.updateStatus(subscriptionId, 'inactive');
  }

  getActiveSubscriptionsForOwner(applicationId, ownerType, ownerId) {
    return this.subscriptionRepository.findActiveByOwner(applicationId, ownerType, ownerId);
  }
}

module.exports = SubscriptionService;
