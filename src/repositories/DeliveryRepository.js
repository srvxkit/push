class DeliveryRepository {
  constructor(db) {
    this.db = db;
  }

  _collection() {
    return this.db.getCollection ? this.db.getCollection('notifications') : [];
  }

  _appsCollection() {
    return this.db.getCollection ? this.db.getCollection('applications') : [];
  }

  create({ id, applicationId, jobId, notificationId, idempotencyKey, target, subscription, notification, status, lastError = null, deliveryId = null }) {
    const now = new Date().toISOString();
    const notifications = this._collection();

    const record = {
      id: deliveryId || id,
      application_id: applicationId,
      job_id: String(jobId || ''),
      notification_id: String(notificationId || ''),
      idempotency_key: idempotencyKey || null,
      target: target || null,
      subscription_endpoint: subscription ? subscription.endpoint : null,
      notification: notification || null,
      status,
      last_error: lastError,
      created_at: now,
      sent_at: status === 'processed' ? now : null
    };

    notifications.push(record);
    if (this.db.save) this.db.save();
    return record;
  }

  findById(id) {
    return this._collection().find(n => n.id === id) || null;
  }

  findByJobId(applicationId, jobId) {
    return this._collection().find(n => n.application_id === applicationId && n.job_id === String(jobId)) || null;
  }

  getStats() {
    const apps = this._appsCollection();
    const notifications = this._collection();

    const appsCount = apps.length;
    const appsList = [...apps]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(a => ({ id: a.id, name: a.name, status: a.status, created_at: a.created_at }));

    let sent = 0, failed = 0, invalid = 0;
    notifications.forEach(n => {
      if (n.status === 'processed') sent++;
      else if (n.status === 'invalid_subscription') invalid++;
      else failed++;
    });

    const recentDeliveries = [...notifications]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map(n => ({
        id: n.id,
        application_id: n.application_id,
        job_id: n.job_id,
        notification_id: n.notification_id,
        status: n.status,
        last_error: n.last_error,
        created_at: n.created_at,
        sent_at: n.sent_at
      }));

    return {
      applications: appsCount,
      applicationsList: appsList,
      subscriptions: {
        total: 0,
        active: 0,
        inactive: 0
      },
      presence: {
        active: 0
      },
      deliveries: {
        total: notifications.length,
        sent,
        pending: 0,
        processing: 0,
        failed,
        expired: invalid
      },
      recentDeliveries
    };
  }
}

module.exports = DeliveryRepository;
