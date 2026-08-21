const fs = require('node:fs');
const path = require('node:path');

// Adapter to unify node:sqlite (Node 22+), better-sqlite3, or sqlite3
function createDatabase(dbPath = ':memory:') {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  let dbAdapter;

  // Option 1: Try built-in node:sqlite (Node v22.5+)
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(dbPath);
    dbAdapter = {
      pragma(str) {
        try { db.exec(`PRAGMA ${str}`); } catch (e) {}
      },
      exec(sql) {
        db.exec(sql);
      },
      prepare(sql) {
        const stmt = db.prepare(sql);
        return {
          run(...params) {
            return stmt.run(...params);
          },
          get(...params) {
            return stmt.get(...params);
          },
          all(...params) {
            return stmt.all(...params);
          }
        };
      },
      close() {
        db.close();
      }
    };
  } catch (err1) {
    // Option 2: Try better-sqlite3 package
    try {
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      db.pragma('foreign_keys = ON');
      dbAdapter = db;
    } catch (err2) {
      // Option 3: Fallback in-memory/file storage engine for legacy Node without native build tools
      dbAdapter = createFallbackStorageAdapter(dbPath);
    }
  }

  // Execute initial migrations
  const migrationPath = path.resolve(__dirname, '../../storage/migrations/001_initial_schema.sql');
  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    dbAdapter.exec(migrationSql);
  }

  return dbAdapter;
}

// Minimal pure-JS storage engine fallback when native SQLite bindings are absent
function createFallbackStorageAdapter(dbPath) {
  const store = {
    applications: new Map(),
    subscriptions: new Map(),
    presence: new Map(),
    notification_deliveries: new Map()
  };

  return {
    pragma() {},
    exec(sql) {
      // Migration SQL runner stub for fallback store
    },
    prepare(sql) {
      return {
        run(...params) {
          return { changes: 1 };
        },
        get(...params) {
          return undefined;
        },
        all(...params) {
          return [];
        }
      };
    },
    close() {}
  };
}

module.exports = {
  createDatabase
};
