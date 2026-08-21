const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class ApiKeyModel {
  constructor(dataFile = null) {
    this.dataFile = dataFile || path.resolve(process.cwd(), 'data/api-keys.json');
    this.ensureDataFile();
  }

  ensureDataFile() {
    if (this.dataFile === ':memory:') return;
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      fs.writeFileSync(this.dataFile, JSON.stringify([]));
    }
  }

  hashKey(key) {
    return crypto.createHash('sha256').update(String(key)).digest('hex');
  }

  getAll() {
    if (this.dataFile === ':memory:') return this.memoryKeys || [];
    try {
      const raw = fs.readFileSync(this.dataFile, 'utf8').trim();
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveAll(keys) {
    if (this.dataFile === ':memory:') {
      this.memoryKeys = keys;
      return;
    }
    fs.writeFileSync(this.dataFile, JSON.stringify(keys, null, 2), 'utf8');
  }

  findByName(name) {
    if (!name) return null;
    const target = String(name).trim().toLowerCase();
    const keys = this.getAll();
    return keys.find(k => k.name && String(k.name).trim().toLowerCase() === target) || null;
  }

  save({ id, name, key, owner, scopes = [], allowUpdate = false }) {
    const keys = this.getAll();
    const keyHash = this.hashKey(key);

    const nameTrimmed = String(name || owner || '').trim();
    if (!nameTrimmed) {
      throw new Error('Application name is required.');
    }

    // Check unique name constraint
    const existingByName = keys.find(k => k.name && String(k.name).trim().toLowerCase() === nameTrimmed.toLowerCase());
    if (existingByName && !allowUpdate && (!id || existingByName.id !== id)) {
      throw new Error(`An application with the name "${nameTrimmed}" already exists.`);
    }

    const existingById = id ? keys.find(k => k.id === id) : null;

    if (existingById) {
      existingById.name = nameTrimmed;
      existingById.keyHash = keyHash;
      existingById.owner = owner || nameTrimmed;
      existingById.active = true;
      existingById.updatedAt = new Date().toISOString();
    } else {
      keys.push({
        id: id || `app_${crypto.randomBytes(8).toString('hex')}`,
        name: nameTrimmed,
        keyHash,
        owner: owner || nameTrimmed,
        scopes,
        active: true,
        createdAt: new Date().toISOString()
      });
    }

    this._saveAll(keys);
    return true;
  }

  find(key) {
    if (!key) return null;
    const keyHash = this.hashKey(key);
    const keys = this.getAll();
    return keys.find(k => (k.keyHash === keyHash || k.key === key) && k.active) || null;
  }

  delete(keyOrId) {
    const keyHash = this.hashKey(keyOrId);
    let keys = this.getAll();
    const len = keys.length;
    keys = keys.filter(k => k.keyHash !== keyHash && k.id !== keyOrId && k.key !== keyOrId);

    if (keys.length !== len) {
      this._saveAll(keys);
      return true;
    }
    return false;
  }
}

module.exports = new ApiKeyModel();
module.exports.ApiKeyModel = ApiKeyModel;
