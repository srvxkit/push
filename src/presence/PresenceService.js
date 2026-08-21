const crypto = require('node:crypto');
const { ValidationError } = require('../errors/AppError');

class PresenceService {
  constructor(presenceRepository, defaultTtlSeconds = 300) {
    this.presenceRepository = presenceRepository;
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  recordHeartbeat(applicationId, payload) {
    const { owner_type, owner_id, session_id, subscription_id, ttl_seconds } = payload || {};

    if (!owner_type || !['admin', 'user'].includes(owner_type.toLowerCase())) {
      throw new ValidationError('owner_type must be either "admin" or "user"');
    }

    if (owner_id === undefined || owner_id === null || String(owner_id).trim() === '') {
      throw new ValidationError('owner_id is required');
    }

    if (!session_id || typeof session_id !== 'string' || session_id.trim() === '') {
      throw new ValidationError('session_id is required');
    }

    const ttl = ttl_seconds && Number.isInteger(ttl_seconds) && ttl_seconds > 0
      ? ttl_seconds
      : this.defaultTtlSeconds;

    const id = 'prs_' + crypto.randomBytes(12).toString('hex');

    return this.presenceRepository.upsert({
      id,
      applicationId,
      subscriptionId: subscription_id || null,
      ownerType: owner_type.toLowerCase(),
      ownerId: owner_id,
      sessionId: session_id,
      ttlSeconds: ttl
    });
  }

  recordLogout(applicationId, payload) {
    const { session_id } = payload || {};
    if (!session_id || typeof session_id !== 'string') {
      throw new ValidationError('session_id is required for logout');
    }

    return this.presenceRepository.deleteSession(applicationId, session_id);
  }

  hasActivePresence(applicationId, subscriptionId, ownerType, ownerId) {
    return this.presenceRepository.hasActivePresenceForSubscription(applicationId, subscriptionId, ownerType, ownerId);
  }
}

module.exports = PresenceService;
