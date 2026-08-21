class PresenceRepository {
  constructor(db) {
    this.db = db;
  }

  _collection() {
    return this.db.getCollection ? this.db.getCollection('presence') : [];
  }

  upsert({ id, applicationId, subscriptionId = null, ownerType, ownerId, sessionId, ttlSeconds = 300 }) {
    const now = new Date();
    const lastSeenAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const presences = this._collection();

    const existing = presences.find(p => p.application_id === applicationId && p.session_id === sessionId);

    if (existing) {
      existing.subscription_id = subscriptionId || existing.subscription_id;
      existing.owner_type = ownerType;
      existing.owner_id = String(ownerId);
      existing.last_seen_at = lastSeenAt;
      existing.expires_at = expiresAt;
      if (this.db.save) this.db.save();
      return existing;
    } else {
      const prs = {
        id,
        application_id: applicationId,
        subscription_id: subscriptionId,
        owner_type: ownerType,
        owner_id: String(ownerId),
        session_id: sessionId,
        last_seen_at: lastSeenAt,
        expires_at: expiresAt
      };
      presences.push(prs);
      if (this.db.save) this.db.save();
      return prs;
    }
  }

  findBySessionId(applicationId, sessionId) {
    const prs = this._collection().find(p => p.application_id === applicationId && p.session_id === sessionId);
    return prs || null;
  }

  findActiveSessionsForOwner(applicationId, ownerType, ownerId) {
    const nowStr = new Date().toISOString();
    const ownerIdStr = String(ownerId);
    return this._collection().filter(p =>
      p.application_id === applicationId &&
      p.owner_type === ownerType &&
      String(p.owner_id) === ownerIdStr &&
      p.expires_at > nowStr
    );
  }

  hasActivePresenceForSubscription(applicationId, subscriptionId, ownerType, ownerId) {
    const nowStr = new Date().toISOString();
    const ownerIdStr = String(ownerId);

    const matches = this._collection().filter(p =>
      p.application_id === applicationId &&
      p.owner_type === ownerType &&
      String(p.owner_id) === ownerIdStr &&
      p.expires_at > nowStr &&
      (p.subscription_id === subscriptionId || p.subscription_id === null || p.subscription_id === undefined)
    );

    return matches.length > 0;
  }

  deleteSession(applicationId, sessionId) {
    const presences = this._collection();
    const index = presences.findIndex(p => p.application_id === applicationId && p.session_id === sessionId);
    if (index >= 0) {
      presences.splice(index, 1);
      if (this.db.save) this.db.save();
      return true;
    }
    return false;
  }

  deleteBySubscription(applicationId, subscriptionId) {
    const presences = this._collection();
    let count = 0;
    for (let i = presences.length - 1; i >= 0; i--) {
      if (presences[i].application_id === applicationId && presences[i].subscription_id === subscriptionId) {
        presences.splice(i, 1);
        count++;
      }
    }
    if (count > 0 && this.db.save) {
      this.db.save();
    }
    return count > 0;
  }
}

module.exports = PresenceRepository;
