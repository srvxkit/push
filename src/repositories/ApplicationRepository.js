class ApplicationRepository {
  constructor(db) {
    this.db = db;
  }

  _collection() {
    return this.db.getCollection ? this.db.getCollection('applications') : [];
  }

  create({ id, name, apiKeyHash, status = 'active' }) {
    const now = new Date().toISOString();
    const app = {
      id,
      name,
      api_key_hash: apiKeyHash,
      status,
      created_at: now,
      updated_at: now
    };

    const apps = this._collection();
    const index = apps.findIndex(a => a.id === id);
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

  findByApiKeyHash(apiKeyHash) {
    const app = this._collection().find(a => a.api_key_hash === apiKeyHash && a.status === 'active');
    return app || null;
  }

  findAll() {
    return [...this._collection()].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  updateApiKeyHash(id, apiKeyHash) {
    const app = this.findById(id);
    if (app) {
      app.api_key_hash = apiKeyHash;
      app.updated_at = new Date().toISOString();
      if (this.db.save) this.db.save();
      return app;
    }
    return null;
  }
}

module.exports = ApplicationRepository;
