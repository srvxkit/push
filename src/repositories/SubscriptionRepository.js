class SubscriptionRepository {
  constructor(db) {
    this.db = db;
  }

  upsert({ id, applicationId, ownerType, ownerId, deviceId, endpoint, p256dh, auth, status = 'active' }) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO subscriptions (id, application_id, owner_type, owner_id, device_id, endpoint, p256dh, auth, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(application_id, endpoint) DO UPDATE SET
        owner_type = excluded.owner_type,
        owner_id = excluded.owner_id,
        device_id = excluded.device_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        status = excluded.status,
        updated_at = excluded.updated_at
    `);

    stmt.run(id, applicationId, ownerType, String(ownerId), deviceId || null, endpoint, p256dh, auth, status, now, now);
    return this.findByEndpoint(applicationId, endpoint);
  }

  findById(applicationId, id) {
    const stmt = this.db.prepare('SELECT * FROM subscriptions WHERE application_id = ? AND id = ?');
    return stmt.get(applicationId, id) || null;
  }

  findByEndpoint(applicationId, endpoint) {
    const stmt = this.db.prepare('SELECT * FROM subscriptions WHERE application_id = ? AND endpoint = ?');
    return stmt.get(applicationId, endpoint) || null;
  }

  findActiveByOwner(applicationId, ownerType, ownerId) {
    const stmt = this.db.prepare(`
      SELECT * FROM subscriptions
      WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND status = 'active'
    `);
    return stmt.all(applicationId, ownerType, String(ownerId));
  }

  findAllByApplication(applicationId, { ownerType = null, ownerId = null } = {}) {
    let sql = 'SELECT * FROM subscriptions WHERE application_id = ?';
    const params = [applicationId];

    if (ownerType) {
      sql += ' AND owner_type = ?';
      params.push(ownerType);
    }
    if (ownerId) {
      sql += ' AND owner_id = ?';
      params.push(String(ownerId));
    }

    sql += ' ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  findAll() {
    const stmt = this.db.prepare(`
      SELECT s.*, a.name as application_name
      FROM subscriptions s
      LEFT JOIN applications a ON s.application_id = a.id
      ORDER BY s.created_at DESC
    `);
    return stmt.all();
  }

  findActiveByOwners(applicationId, ownerType, ownerIds) {
    if (!ownerIds || ownerIds.length === 0) return [];
    const placeholders = ownerIds.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM subscriptions
      WHERE application_id = ? AND owner_type = ? AND owner_id IN (${placeholders}) AND status = 'active'
    `);
    return stmt.all(applicationId, ownerType, ...ownerIds.map(String));
  }

  updateStatus(id, status) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, now, id);
  }

  delete(applicationId, id) {
    const stmt = this.db.prepare('DELETE FROM subscriptions WHERE application_id = ? AND id = ?');
    const result = stmt.run(applicationId, id);
    return result.changes > 0;
  }
}

module.exports = SubscriptionRepository;
