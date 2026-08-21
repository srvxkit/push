class SubscriptionRepository {
  constructor(db) {
    this.db = db;
  }

  _collection() {
    return this.db.getCollection ? this.db.getCollection('subscriptions') : [];
  }

  _appsCollection() {
    return this.db.getCollection ? this.db.getCollection('applications') : [];
  }

  upsert({ id, applicationId, ownerType, ownerId, deviceId, endpoint, p256dh, auth, status = 'active' }) {
    const now = new Date().toISOString();
    const subs = this._collection();

    const existing = subs.find(s => s.application_id === applicationId && s.endpoint === endpoint);

    if (existing) {
      existing.owner_type = ownerType;
      existing.owner_id = String(ownerId);
      existing.device_id = deviceId || null;
      existing.p256dh = p256dh;
      existing.auth = auth;
      existing.status = status;
      existing.updated_at = now;
      if (this.db.save) this.db.save();
      return existing;
    } else {
      const sub = {
        id,
        application_id: applicationId,
        owner_type: ownerType,
        owner_id: String(ownerId),
        device_id: deviceId || null,
        endpoint,
        p256dh,
        auth,
        status,
        created_at: now,
        updated_at: now
      };
      subs.push(sub);
      if (this.db.save) this.db.save();
      return sub;
    }
  }

  findById(applicationId, id) {
    const sub = this._collection().find(s => s.application_id === applicationId && s.id === id);
    return sub || null;
  }

  findByEndpoint(applicationId, endpoint) {
    const sub = this._collection().find(s => s.application_id === applicationId && s.endpoint === endpoint);
    return sub || null;
  }

  findActiveByOwner(applicationId, ownerType, ownerId) {
    const ownerIdStr = String(ownerId);
    return this._collection().filter(s =>
      s.application_id === applicationId &&
      s.owner_type === ownerType &&
      String(s.owner_id) === ownerIdStr &&
      s.status === 'active'
    );
  }

  findAllByApplication(applicationId, { ownerType = null, ownerId = null } = {}) {
    const ownerIdStr = ownerId ? String(ownerId) : null;
    let list = this._collection().filter(s => s.application_id === applicationId);

    if (ownerType) {
      list = list.filter(s => s.owner_type === ownerType);
    }
    if (ownerIdStr) {
      list = list.filter(s => String(s.owner_id) === ownerIdStr);
    }

    return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  findAll() {
    const apps = this._appsCollection();
    return this._collection().map(s => {
      const app = apps.find(a => a.id === s.application_id);
      return {
        ...s,
        application_name: app ? app.name : s.application_id
      };
    }).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  findActiveByOwners(applicationId, ownerType, ownerIds) {
    if (!ownerIds || ownerIds.length === 0) return [];
    const ownerIdStrs = ownerIds.map(String);
    return this._collection().filter(s =>
      s.application_id === applicationId &&
      s.owner_type === ownerType &&
      ownerIdStrs.includes(String(s.owner_id)) &&
      s.status === 'active'
    );
  }

  updateStatus(id, status) {
    const now = new Date().toISOString();
    const sub = this._collection().find(s => s.id === id);
    if (sub) {
      sub.status = status;
      sub.updated_at = now;
      if (this.db.save) this.db.save();
    }
  }

  delete(applicationId, id) {
    const subs = this._collection();
    const index = subs.findIndex(s => s.application_id === applicationId && s.id === id);
    if (index >= 0) {
      subs.splice(index, 1);
      if (this.db.save) this.db.save();
      return true;
    }
    return false;
  }
}

module.exports = SubscriptionRepository;
