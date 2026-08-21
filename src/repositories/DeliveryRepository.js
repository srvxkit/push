class DeliveryRepository {
  constructor(db) {
    this.db = db;
  }

  create({ id, applicationId, notificationId, subscriptionId, ownerType, ownerId, payloadJson, idempotencyKey = null }) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO notification_deliveries (id, application_id, notification_id, subscription_id, owner_type, owner_id, status, attempts, last_error, idempotency_key, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?, ?)
      ON CONFLICT(application_id, idempotency_key, subscription_id) DO NOTHING
    `);

    const result = stmt.run(id, applicationId, notificationId, subscriptionId, ownerType, String(ownerId), idempotencyKey, payloadJson, now);
    if (result.changes === 0 && idempotencyKey) {
      // Idempotency duplicate skipped
      return this.findExisting(applicationId, idempotencyKey, subscriptionId);
    }
    return this.findById(id);
  }

  findExisting(applicationId, idempotencyKey, subscriptionId) {
    const stmt = this.db.prepare(`
      SELECT * FROM notification_deliveries
      WHERE application_id = ? AND idempotency_key = ? AND subscription_id = ?
    `);
    return stmt.get(applicationId, idempotencyKey, subscriptionId) || null;
  }

  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM notification_deliveries WHERE id = ?');
    return stmt.get(id) || null;
  }

  claimPendingJobs(limit = 10) {
    // Atomically claim jobs by setting status to 'processing'
    const selectStmt = this.db.prepare(`
      SELECT id FROM notification_deliveries
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `);

    const rows = selectStmt.all(limit);
    if (rows.length === 0) return [];

    const ids = rows.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');

    const updateStmt = this.db.prepare(`
      UPDATE notification_deliveries
      SET status = 'processing'
      WHERE id IN (${placeholders}) AND status = 'pending'
    `);

    updateStmt.run(...ids);

    const getStmt = this.db.prepare(`
      SELECT d.*, s.endpoint, s.p256dh, s.auth, s.status as subscription_status
      FROM notification_deliveries d
      JOIN subscriptions s ON d.subscription_id = s.id
      WHERE d.id IN (${placeholders})
    `);

    return getStmt.all(...ids);
  }

  updateStatus(id, { status, attempts, lastError = null, sentAt = null }) {
    const stmt = this.db.prepare(`
      UPDATE notification_deliveries
      SET status = ?, attempts = ?, last_error = ?, sent_at = ?
      WHERE id = ?
    `);
    stmt.run(status, attempts, lastError, sentAt, id);
  }

  resetProcessingToPending() {
    // Cleanup stuck processing jobs on worker start
    const stmt = this.db.prepare(`
      UPDATE notification_deliveries
      SET status = 'pending'
      WHERE status = 'processing'
    `);
    stmt.run();
  }

  getStats() {
    const now = new Date().toISOString();

    const appsCount = this.db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
    const appsList = this.db.prepare('SELECT id, name, status, created_at FROM applications ORDER BY created_at DESC').all();

    const subsCount = this.db.prepare('SELECT COUNT(*) as count FROM subscriptions').get().count;
    const activeSubsCount = this.db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'").get().count;
    const activePresenceCount = this.db.prepare('SELECT COUNT(*) as count FROM presence WHERE expires_at > ?').get(now).count;

    const deliveryStats = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM notification_deliveries
    `).get();

    const recentDeliveries = this.db.prepare(`
      SELECT d.id, d.application_id, d.notification_id, d.owner_type, d.owner_id, d.status, d.attempts, d.last_error, d.created_at, d.sent_at
      FROM notification_deliveries d
      ORDER BY d.created_at DESC
      LIMIT 10
    `).all();

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
        total: deliveryStats.total || 0,
        sent: deliveryStats.sent || 0,
        pending: deliveryStats.pending || 0,
        processing: deliveryStats.processing || 0,
        failed: deliveryStats.failed || 0,
        expired: deliveryStats.expired || 0
      },
      recentDeliveries
    };
  }
}

module.exports = DeliveryRepository;
