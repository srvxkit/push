const crypto = require('node:crypto');

class ApplicationRepository {
  constructor(db) {
    this.db = db;
  }

  _collection() {
    return this.db.getCollection ? this.db.getCollection('applications') : [];
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  create({ id, name, apiKey, status = 'active' }) {
    const now = new Date().toISOString();
    const apiKeyHash = this.hashToken(apiKey);

    const app = {
      id,
      name,
      application_key: apiKey,
      api_key_hash: apiKeyHash,
      status,
      created_at: now,
      updated_at: now
    };

    const apps = this._collection();
    const index = apps.findIndex(a => a.id === id || a.name === name);
    if (index >= 0) {
      apps[index] = app;
    } else {
      apps.push(app);
    }

    if (this.db.save) this.db.save();
    return app;
  }

  findById(id) {
    const app = this._collection().find(a => a.id === id);
    return app || null;
  }

  findByName(name) {
    const app = this._collection().find(a => a.name === name);
    return app || null;
  }

  findByApiKey(apiKey) {
    const hash = this.hashToken(apiKey);
    const app = this._collection().find(a => (a.application_key === apiKey || a.api_key_hash === hash) && a.status === 'active');
    return app || null;
  }

  findByApiKeyHash(apiKeyHash) {
    const app = this._collection().find(a => a.api_key_hash === apiKeyHash && a.status === 'active');
    return app || null;
  }

  findAll() {
    return [...this._collection()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
}

module.exports = ApplicationRepository;
