class PresenceRepository {
  constructor(db) {
    this.db = db;
  }

  upsert({ id, applicationId, subscriptionId = null, ownerType, ownerId, sessionId, ttlSeconds = 300 }) {
    const now = new Date();
    const lastSeenAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO presence (id, application_id, subscription_id, owner_type, owner_id, session_id, last_seen_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(application_id, session_id) DO UPDATE SET
        subscription_id = COALESCE(excluded.subscription_id, presence.subscription_id),
        owner_type = excluded.owner_type,
        owner_id = excluded.owner_id,
        last_seen_at = excluded.last_seen_at,
        expires_at = excluded.expires_at
    `);

    stmt.run(id, applicationId, subscriptionId, ownerType, String(ownerId), sessionId, lastSeenAt, expiresAt);
    return this.findBySessionId(applicationId, sessionId);
  }

  findBySessionId(applicationId, sessionId) {
    const stmt = this.db.prepare('SELECT * FROM presence WHERE application_id = ? AND session_id = ?');
    return stmt.get(applicationId, sessionId) || null;
  }

  findActiveSessionsForOwner(applicationId, ownerType, ownerId) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM presence
      WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND expires_at > ?
    `);
    return stmt.all(applicationId, ownerType, String(ownerId), now);
  }

  hasActivePresenceForSubscription(applicationId, subscriptionId, ownerType, ownerId) {
    const now = new Date().toISOString();
    // Check if there is an active session linked to this specific subscription or for this owner in general
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM presence
      WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND expires_at > ?
      AND (subscription_id = ? OR subscription_id IS NULL)
    `);
    const row = stmt.get(applicationId, ownerType, String(ownerId), now, subscriptionId);
    return row.count > 0;
  }

  deleteSession(applicationId, sessionId) {
    const stmt = this.db.prepare('DELETE FROM presence WHERE application_id = ? AND session_id = ?');
    const result = stmt.run(applicationId, sessionId);
    return result.changes > 0;
  }

  deleteBySubscription(applicationId, subscriptionId) {
    const stmt = this.db.prepare('DELETE FROM presence WHERE application_id = ? AND subscription_id = ?');
    const result = stmt.run(applicationId, subscriptionId);
    return result.changes > 0;
  }
}

module.exports = PresenceRepository;
