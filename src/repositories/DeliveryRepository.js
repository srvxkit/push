class DeliveryRepository {
  constructor(db) {
    this.db = db;
  }

  _collection() {
    return this.db.getCollection ? this.db.getCollection('notification_deliveries') : [];
  }

  _subsCollection() {
    return this.db.getCollection ? this.db.getCollection('subscriptions') : [];
  }

  _appsCollection() {
    return this.db.getCollection ? this.db.getCollection('applications') : [];
  }

  _presenceCollection() {
    return this.db.getCollection ? this.db.getCollection('presence') : [];
  }

  create({ id, applicationId, notificationId, subscriptionId, ownerType, ownerId, payloadJson, idempotencyKey = null }) {
    const now = new Date().toISOString();
    const deliveries = this._collection();

    if (idempotencyKey) {
      const existing = deliveries.find(d =>
        d.application_id === applicationId &&
        d.idempotency_key === idempotencyKey &&
        d.subscription_id === subscriptionId
      );
      if (existing) return existing;
    }

    const delivery = {
      id,
      application_id: applicationId,
      notification_id: notificationId,
      subscription_id: subscriptionId,
      owner_type: ownerType,
      owner_id: String(ownerId),
      status: 'pending',
      attempts: 0,
      last_error: null,
      idempotency_key: idempotencyKey,
      payload_json: payloadJson,
      created_at: now,
      sent_at: null
    };

    deliveries.push(delivery);
    if (this.db.save) this.db.save();
    return delivery;
  }

  findExisting(applicationId, idempotencyKey, subscriptionId) {
    const del = this._collection().find(d =>
      d.application_id === applicationId &&
      d.idempotency_key === idempotencyKey &&
      d.subscription_id === subscriptionId
    );
    return del || null;
  }

  findById(id) {
    const del = this._collection().find(d => d.id === id);
    return del || null;
  }

  claimPendingJobs(limit = 10) {
    const deliveries = this._collection();
    const subs = this._subsCollection();

    const pendingJobs = deliveries
      .filter(d => d.status === 'pending')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .slice(0, limit);

    if (pendingJobs.length === 0) return [];

    const claimed = [];
    pendingJobs.forEach(job => {
      job.status = 'processing';
      const sub = subs.find(s => s.id === job.subscription_id);
      claimed.push({
        ...job,
        endpoint: sub ? sub.endpoint : '',
        p256dh: sub ? sub.p256dh : '',
        auth: sub ? sub.auth : '',
        subscription_status: sub ? sub.status : 'inactive'
      });
    });

    if (this.db.save) this.db.save();
    return claimed;
  }

  updateStatus(id, { status, attempts, lastError = null, sentAt = null }) {
    const del = this.findById(id);
    if (del) {
      del.status = status;
      del.attempts = attempts;
      del.last_error = lastError;
      del.sent_at = sentAt;
      if (this.db.save) this.db.save();
    }
  }

  resetProcessingToPending() {
    const deliveries = this._collection();
    let resetCount = 0;
    deliveries.forEach(d => {
      if (d.status === 'processing') {
        d.status = 'pending';
        resetCount++;
      }
    });
    if (resetCount > 0 && this.db.save) {
      this.db.save();
    }
  }

  getStats() {
    const nowStr = new Date().toISOString();
    const apps = this._appsCollection();
    const subs = this._subsCollection();
    const presence = this._presenceCollection();
    const deliveries = this._collection();

    const appsCount = apps.length;
    const appsList = [...apps]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(a => ({ id: a.id, name: a.name, status: a.status, created_at: a.created_at }));

    const subsCount = subs.length;
    const activeSubsCount = subs.filter(s => s.status === 'active').length;
    const activePresenceCount = presence.filter(p => p.expires_at > nowStr).length;

    let sent = 0, pending = 0, processing = 0, failed = 0, expired = 0;
    deliveries.forEach(d => {
      if (d.status === 'sent') sent++;
      else if (d.status === 'pending') pending++;
      else if (d.status === 'processing') processing++;
      else if (d.status === 'failed') failed++;
      else if (d.status === 'expired') expired++;
    });

    const recentDeliveries = [...deliveries]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map(d => ({
        id: d.id,
        application_id: d.application_id,
        notification_id: d.notification_id,
        owner_type: d.owner_type,
        owner_id: d.owner_id,
        status: d.status,
        attempts: d.attempts,
        last_error: d.last_error,
        created_at: d.created_at,
        sent_at: d.sent_at
      }));

    return {
      applications: appsCount,
      applicationsList: appsList,
      subscriptions: {
        total: subsCount,
        active: activeSubsCount,
        inactive: subsCount - activeSubsCount
      },
      presence: {
        active: activePresenceCount
      },
      deliveries: {
        total: deliveries.length,
        sent,
        pending,
        processing,
        failed,
        expired
      },
      recentDeliveries
    };
  }
}

module.exports = DeliveryRepository;
