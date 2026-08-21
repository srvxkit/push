class ApplicationRepository {
  constructor(db) {
    this.db = db;
  }

  create({ id, name, apiKeyHash, status = 'active' }) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO applications (id, name, api_key_hash, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, name, apiKeyHash, status, now, now);
    return this.findById(id);
  }

  findById(id) {
    const stmt = this.db.prepare('SELECT * FROM applications WHERE id = ?');
    return stmt.get(id) || null;
  }

  findByName(name) {
    const stmt = this.db.prepare('SELECT * FROM applications WHERE name = ?');
    return stmt.get(name) || null;
  }

  findByApiKeyHash(apiKeyHash) {
    const stmt = this.db.prepare("SELECT * FROM applications WHERE api_key_hash = ? AND status = 'active'");
    return stmt.get(apiKeyHash) || null;
  }

  findAll() {
    const stmt = this.db.prepare('SELECT id, name, status, created_at, updated_at FROM applications ORDER BY created_at DESC');
    return stmt.all();
  }

  updateApiKeyHash(id, apiKeyHash) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE applications SET api_key_hash = ?, updated_at = ? WHERE id = ?');
    stmt.run(apiKeyHash, now, id);
    return this.findById(id);
  }
}

module.exports = ApplicationRepository;
