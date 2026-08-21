const fs = require('node:fs');
const path = require('node:path');

class JsonDatabase {
  constructor(filePath = './storage/push_server.json') {
    this.isMemory = filePath === ':memory:';
    this.filePath = this.isMemory ? null : path.resolve(process.cwd(), filePath.replace(/\.[^/.]+$/, '') + '.json');
    this.data = {
      applications: [],
      subscriptions: [],
      presence: [],
      notification_deliveries: []
    };

    this._load();
  }

  _load() {
    if (this.isMemory || !this.filePath) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8').trim();
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data = {
            applications: Array.isArray(parsed.applications) ? parsed.applications : [],
            subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
            presence: Array.isArray(parsed.presence) ? parsed.presence : [],
            notification_deliveries: Array.isArray(parsed.notification_deliveries) ? parsed.notification_deliveries : []
          };
        }
      } else {
        this._save();
      }
    } catch (err) {
      console.error(`[Storage Error] Failed to load JSON database file at ${this.filePath}:`, err.message);
    }
  }

  _save() {
    if (this.isMemory || !this.filePath) return;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error(`[Storage Error] Failed to save JSON database file to ${this.filePath}:`, err.message);
    }
  }

  getCollection(name) {
    if (!this.data[name]) {
      this.data[name] = [];
    }
    return this.data[name];
  }

  save() {
    this._save();
  }

  close() {
    this._save();
  }
}

function createDatabase(dbPath = './storage/push_server.json') {
  return new JsonDatabase(dbPath);
}

module.exports = {
  createDatabase,
  JsonDatabase
};
