const fs = require('node:fs');
const path = require('node:path');

// Adapter to unify node:sqlite (Node 22+), better-sqlite3, sqlite3, or pure JS file storage
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
    // Option 2A: Try better-sqlite3 package if installed
    try {
      const Database = require('better-sqlite3');
      const db = new Database(dbPath);
      db.pragma('foreign_keys = ON');
      dbAdapter = db;
    } catch (err2) {
      // Option 2B: Try sqlite3 package if installed
      try {
        const sqlite3 = require('sqlite3');
        const db = new sqlite3.Database(dbPath);
        dbAdapter = createSqlite3Wrapper(db);
      } catch (err3) {
        // Option 3: Pure JS file-backed storage engine for Node 20 & environments without native addons
        dbAdapter = createFallbackStorageAdapter(dbPath);
      }
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

// Wrapper for sqlite3 npm package if installed
function createSqlite3Wrapper(db) {
  db.run('PRAGMA foreign_keys = ON');
  return {
    pragma(str) {
      try { db.run(`PRAGMA ${str}`); } catch (e) {}
    },
    exec(sql) {
      db.exec(sql);
    },
    prepare(sql) {
      return {
        run(...params) {
          db.run(sql, params);
          return { changes: 1 };
        },
        get(...params) {
          let result;
          db.get(sql, params, (err, row) => { result = row; });
          return result;
        },
        all(...params) {
          let results = [];
          db.all(sql, params, (err, rows) => { results = rows || []; });
          return results;
        }
      };
    },
    close() {
      db.close();
    }
  };
}

// Pure JS file-backed database storage engine for legacy/restricted Node environments (Node v20.x, etc.)
function createFallbackStorageAdapter(dbPath) {
  const jsonFilePath = dbPath !== ':memory:'
    ? (dbPath.endsWith('.db') ? dbPath.slice(0, -3) + '.json' : dbPath + '.json')
    : null;

  const tables = {
    applications: new Map(),
    subscriptions: new Map(),
    presence: new Map(),
    notification_deliveries: new Map()
  };

  // Load existing data from file if present
  if (jsonFilePath && fs.existsSync(jsonFilePath)) {
    try {
      const raw = fs.readFileSync(jsonFilePath, 'utf8');
      const data = JSON.parse(raw);
      for (const tName in data) {
        if (tables[tName] && Array.isArray(data[tName])) {
          data[tName].forEach(row => tables[tName].set(row.id, row));
        }
      }
    } catch (e) {}
  }

  function saveToFile() {
    if (!jsonFilePath) return;
    try {
      const exportData = {};
      for (const tName in tables) {
        exportData[tName] = Array.from(tables[tName].values());
      }
      fs.writeFileSync(jsonFilePath, JSON.stringify(exportData, null, 2), 'utf8');
    } catch (e) {}
  }

  return {
    pragma() {},
    exec(sql) {},
    close() { saveToFile(); },
    prepare(sql) {
      const normalizedSql = sql.replace(/\s+/g, ' ').trim();

      return {
        run(...params) {
          // INSERT INTO applications
          if (normalizedSql.startsWith('INSERT INTO applications')) {
            const [id, name, apiKeyHash, status, createdAt, updatedAt] = params;
            const row = { id, name, api_key_hash: apiKeyHash, status, created_at: createdAt, updated_at: updatedAt };
            tables.applications.set(id, row);
            saveToFile();
            return { changes: 1 };
          }

          // UPDATE applications
          if (normalizedSql.startsWith('UPDATE applications')) {
            const [apiKeyHash, updatedAt, id] = params;
            const app = tables.applications.get(id);
            if (app) {
              app.api_key_hash = apiKeyHash;
              app.updated_at = updatedAt;
              saveToFile();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // INSERT INTO subscriptions
          if (normalizedSql.startsWith('INSERT INTO subscriptions')) {
            const [id, applicationId, ownerType, ownerId, deviceId, endpoint, p256dh, auth, status, createdAt, updatedAt] = params;

            // Check conflict on (application_id, endpoint)
            let existingKey = null;
            for (const [key, sub] of tables.subscriptions.entries()) {
              if (sub.application_id === applicationId && sub.endpoint === endpoint) {
                existingKey = key;
                break;
              }
            }

            const targetKey = existingKey || id;
            const subRow = {
              id: targetKey,
              application_id: applicationId,
              owner_type: ownerType,
              owner_id: String(ownerId),
              device_id: deviceId || null,
              endpoint,
              p256dh,
              auth,
              status,
              created_at: existingKey ? (tables.subscriptions.get(existingKey).created_at || createdAt) : createdAt,
              updated_at: updatedAt
            };

            tables.subscriptions.set(targetKey, subRow);
            saveToFile();
            return { changes: 1 };
          }

          // UPDATE subscriptions
          if (normalizedSql.startsWith('UPDATE subscriptions')) {
            const [status, updatedAt, id] = params;
            const sub = tables.subscriptions.get(id);
            if (sub) {
              sub.status = status;
              sub.updated_at = updatedAt;
              saveToFile();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // DELETE FROM subscriptions
          if (normalizedSql.startsWith('DELETE FROM subscriptions')) {
            const [applicationId, id] = params;
            const sub = tables.subscriptions.get(id);
            if (sub && sub.application_id === applicationId) {
              tables.subscriptions.delete(id);
              saveToFile();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // INSERT INTO presence
          if (normalizedSql.startsWith('INSERT INTO presence')) {
            const [id, applicationId, subscriptionId, ownerType, ownerId, sessionId, lastSeenAt, expiresAt] = params;

            // Check conflict on (application_id, session_id)
            let existingKey = null;
            for (const [key, prs] of tables.presence.entries()) {
              if (prs.application_id === applicationId && prs.session_id === sessionId) {
                existingKey = key;
                break;
              }
            }

            const targetKey = existingKey || id;
            const presenceRow = {
              id: targetKey,
              application_id: applicationId,
              subscription_id: subscriptionId || (existingKey ? tables.presence.get(existingKey).subscription_id : null),
              owner_type: ownerType,
              owner_id: String(ownerId),
              session_id: sessionId,
              last_seen_at: lastSeenAt,
              expires_at: expiresAt
            };

            tables.presence.set(targetKey, presenceRow);
            saveToFile();
            return { changes: 1 };
          }

          // DELETE FROM presence
          if (normalizedSql.includes('DELETE FROM presence WHERE application_id = ? AND session_id = ?')) {
            const [applicationId, sessionId] = params;
            let deleted = 0;
            for (const [key, prs] of tables.presence.entries()) {
              if (prs.application_id === applicationId && prs.session_id === sessionId) {
                tables.presence.delete(key);
                deleted++;
              }
            }
            if (deleted > 0) saveToFile();
            return { changes: deleted };
          }

          if (normalizedSql.includes('DELETE FROM presence WHERE application_id = ? AND subscription_id = ?')) {
            const [applicationId, subscriptionId] = params;
            let deleted = 0;
            for (const [key, prs] of tables.presence.entries()) {
              if (prs.application_id === applicationId && prs.subscription_id === subscriptionId) {
                tables.presence.delete(key);
                deleted++;
              }
            }
            if (deleted > 0) saveToFile();
            return { changes: deleted };
          }

          // INSERT INTO notification_deliveries
          if (normalizedSql.startsWith('INSERT INTO notification_deliveries')) {
            const [id, applicationId, notificationId, subscriptionId, ownerType, ownerId, idempotencyKey, payloadJson, createdAt] = params;

            if (idempotencyKey) {
              for (const del of tables.notification_deliveries.values()) {
                if (del.application_id === applicationId && del.idempotency_key === idempotencyKey && del.subscription_id === subscriptionId) {
                  return { changes: 0 };
                }
              }
            }

            const deliveryRow = {
              id,
              application_id: applicationId,
              notification_id: notificationId,
              subscription_id: subscriptionId,
              owner_type: ownerType,
              owner_id: String(ownerId),
              status: 'pending',
              attempts: 0,
              last_error: null,
              idempotency_key: idempotencyKey,
              payload_json: payloadJson,
              created_at: createdAt,
              sent_at: null
            };

            tables.notification_deliveries.set(id, deliveryRow);
            saveToFile();
            return { changes: 1 };
          }

          // UPDATE notification_deliveries status
          if (normalizedSql.startsWith('UPDATE notification_deliveries SET status = ?, attempts = ?, last_error = ?, sent_at = ? WHERE id = ?')) {
            const [status, attempts, lastError, sentAt, id] = params;
            const del = tables.notification_deliveries.get(id);
            if (del) {
              del.status = status;
              del.attempts = attempts;
              del.last_error = lastError;
              del.sent_at = sentAt;
              saveToFile();
              return { changes: 1 };
            }
            return { changes: 0 };
          }

          // UPDATE notification_deliveries claim pending jobs
          if (normalizedSql.includes('UPDATE notification_deliveries SET status = \'processing\' WHERE id IN')) {
            let changes = 0;
            params.forEach(id => {
              const del = tables.notification_deliveries.get(id);
              if (del && del.status === 'pending') {
                del.status = 'processing';
                changes++;
              }
            });
            if (changes > 0) saveToFile();
            return { changes };
          }

          // RESET processing to pending
          if (normalizedSql.includes('UPDATE notification_deliveries SET status = \'pending\' WHERE status = \'processing\'')) {
            let changes = 0;
            for (const del of tables.notification_deliveries.values()) {
              if (del.status === 'processing') {
                del.status = 'pending';
                changes++;
              }
            }
            if (changes > 0) saveToFile();
            return { changes };
          }

          return { changes: 0 };
        },

        get(...params) {
          // SELECT * FROM applications WHERE id = ?
          if (normalizedSql.includes('FROM applications WHERE id = ?')) {
            return tables.applications.get(params[0]);
          }

          // SELECT * FROM applications WHERE name = ?
          if (normalizedSql.includes('FROM applications WHERE name = ?')) {
            for (const app of tables.applications.values()) {
              if (app.name === params[0]) return app;
            }
            return undefined;
          }

          // SELECT * FROM applications WHERE api_key_hash = ?
          if (normalizedSql.includes('FROM applications WHERE api_key_hash = ?')) {
            for (const app of tables.applications.values()) {
              if (app.api_key_hash === params[0] && app.status === 'active') return app;
            }
            return undefined;
          }

          // SELECT COUNT(*) as count FROM applications
          if (normalizedSql.includes('SELECT COUNT(*) as count FROM applications')) {
            return { count: tables.applications.size };
          }

          // SELECT COUNT(*) as count FROM subscriptions
          if (normalizedSql.includes('SELECT COUNT(*) as count FROM subscriptions WHERE status = \'active\'')) {
            let count = 0;
            for (const sub of tables.subscriptions.values()) {
              if (sub.status === 'active') count++;
            }
            return { count };
          }

          if (normalizedSql.includes('SELECT COUNT(*) as count FROM subscriptions')) {
            return { count: tables.subscriptions.size };
          }

          // SELECT COUNT(*) as count FROM presence
          if (normalizedSql.includes('SELECT COUNT(*) as count FROM presence WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND expires_at > ?')) {
            const [appId, ownerType, ownerId, nowStr, subId] = params;
            let count = 0;
            for (const prs of tables.presence.values()) {
              if (prs.application_id === appId && prs.owner_type === ownerType && String(prs.owner_id) === String(ownerId) && prs.expires_at > nowStr) {
                if (subId === undefined || prs.subscription_id === subId || prs.subscription_id === null) {
                  count++;
                }
              }
            }
            return { count };
          }

          if (normalizedSql.includes('SELECT COUNT(*) as count FROM presence WHERE expires_at > ?')) {
            const nowStr = params[0];
            let count = 0;
            for (const prs of tables.presence.values()) {
              if (prs.expires_at > nowStr) count++;
            }
            return { count };
          }

          // SELECT * FROM subscriptions WHERE application_id = ? AND id = ?
          if (normalizedSql.includes('FROM subscriptions WHERE application_id = ? AND id = ?')) {
            const [appId, id] = params;
            const sub = tables.subscriptions.get(id);
            return (sub && sub.application_id === appId) ? sub : undefined;
          }

          // SELECT * FROM subscriptions WHERE application_id = ? AND endpoint = ?
          if (normalizedSql.includes('FROM subscriptions WHERE application_id = ? AND endpoint = ?')) {
            const [appId, endpoint] = params;
            for (const sub of tables.subscriptions.values()) {
              if (sub.application_id === appId && sub.endpoint === endpoint) return sub;
            }
            return undefined;
          }

          // SELECT * FROM presence WHERE application_id = ? AND session_id = ?
          if (normalizedSql.includes('FROM presence WHERE application_id = ? AND session_id = ?')) {
            const [appId, sessionId] = params;
            for (const prs of tables.presence.values()) {
              if (prs.application_id === appId && prs.session_id === sessionId) return prs;
            }
            return undefined;
          }

          // SELECT * FROM notification_deliveries WHERE application_id = ? AND idempotency_key = ? AND subscription_id = ?
          if (normalizedSql.includes('FROM notification_deliveries WHERE application_id = ? AND idempotency_key = ? AND subscription_id = ?')) {
            const [appId, key, subId] = params;
            for (const del of tables.notification_deliveries.values()) {
              if (del.application_id === appId && del.idempotency_key === key && del.subscription_id === subId) return del;
            }
            return undefined;
          }

          // SELECT * FROM notification_deliveries WHERE id = ?
          if (normalizedSql.includes('FROM notification_deliveries WHERE id = ?')) {
            return tables.notification_deliveries.get(params[0]);
          }

          // Aggregate stats for deliveries
          if (normalizedSql.includes('SELECT COUNT(*) as total, SUM(CASE WHEN status = \'sent\' THEN 1 ELSE 0 END) as sent')) {
            let total = 0, sent = 0, pending = 0, processing = 0, failed = 0, expired = 0;
            for (const del of tables.notification_deliveries.values()) {
              total++;
              if (del.status === 'sent') sent++;
              else if (del.status === 'pending') pending++;
              else if (del.status === 'processing') processing++;
              else if (del.status === 'failed') failed++;
              else if (del.status === 'expired') expired++;
            }
            return { total, sent, pending, processing, failed, expired };
          }

          return undefined;
        },

        all(...params) {
          // SELECT id, name, status, created_at, updated_at FROM applications ORDER BY created_at DESC
          if (normalizedSql.includes('FROM applications')) {
            return Array.from(tables.applications.values())
              .sort((a, b) => b.created_at.localeCompare(a.created_at));
          }

          // SELECT * FROM subscriptions WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND status = 'active'
          if (normalizedSql.includes('FROM subscriptions WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND status = \'active\'')) {
            const [appId, ownerType, ownerId] = params;
            const res = [];
            for (const sub of tables.subscriptions.values()) {
              if (sub.application_id === appId && sub.owner_type === ownerType && String(sub.owner_id) === String(ownerId) && sub.status === 'active') {
                res.push(sub);
              }
            }
            return res;
          }

          // SELECT * FROM subscriptions WHERE application_id = ? AND owner_type = ? AND owner_id IN (...)
          if (normalizedSql.includes('FROM subscriptions WHERE application_id = ? AND owner_type = ? AND owner_id IN')) {
            const appId = params[0];
            const ownerType = params[1];
            const ownerIds = params.slice(2).map(String);
            const res = [];
            for (const sub of tables.subscriptions.values()) {
              if (sub.application_id === appId && sub.owner_type === ownerType && ownerIds.includes(String(sub.owner_id)) && sub.status === 'active') {
                res.push(sub);
              }
            }
            return res;
          }

          // SELECT * FROM subscriptions WHERE application_id = ? ...
          if (normalizedSql.includes('FROM subscriptions WHERE application_id = ?')) {
            const appId = params[0];
            const ownerType = params[1] || null;
            const ownerId = params[2] || null;
            const res = [];
            for (const sub of tables.subscriptions.values()) {
              if (sub.application_id === appId) {
                if (ownerType && sub.owner_type !== ownerType) continue;
                if (ownerId && String(sub.owner_id) !== String(ownerId)) continue;
                res.push(sub);
              }
            }
            return res.sort((a, b) => b.created_at.localeCompare(a.created_at));
          }

          // SELECT s.*, a.name as application_name FROM subscriptions s LEFT JOIN applications a ...
          if (normalizedSql.includes('FROM subscriptions s LEFT JOIN applications a')) {
            const res = [];
            for (const sub of tables.subscriptions.values()) {
              const app = tables.applications.get(sub.application_id);
              res.push({
                ...sub,
                application_name: app ? app.name : sub.application_id
              });
            }
            return res.sort((a, b) => b.created_at.localeCompare(a.created_at));
          }

          // SELECT * FROM presence WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND expires_at > ?
          if (normalizedSql.includes('FROM presence WHERE application_id = ? AND owner_type = ? AND owner_id = ? AND expires_at > ?')) {
            const [appId, ownerType, ownerId, nowStr] = params;
            const res = [];
            for (const prs of tables.presence.values()) {
              if (prs.application_id === appId && prs.owner_type === ownerType && String(prs.owner_id) === String(ownerId) && prs.expires_at > nowStr) {
                res.push(prs);
              }
            }
            return res;
          }

          // SELECT id FROM notification_deliveries WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?
          if (normalizedSql.includes('SELECT id FROM notification_deliveries WHERE status = \'pending\'')) {
            const limit = params[0] || 10;
            const pending = [];
            for (const del of tables.notification_deliveries.values()) {
              if (del.status === 'pending') pending.push(del);
            }
            pending.sort((a, b) => a.created_at.localeCompare(b.created_at));
            return pending.slice(0, limit).map(d => ({ id: d.id }));
          }

          // SELECT d.*, s.endpoint, s.p256dh, s.auth, s.status as subscription_status FROM notification_deliveries d JOIN subscriptions s ...
          if (normalizedSql.includes('FROM notification_deliveries d JOIN subscriptions s ON d.subscription_id = s.id')) {
            const ids = params;
            const res = [];
            ids.forEach(id => {
              const del = tables.notification_deliveries.get(id);
              if (del) {
                const sub = tables.subscriptions.get(del.subscription_id);
                res.push({
                  ...del,
                  endpoint: sub ? sub.endpoint : '',
                  p256dh: sub ? sub.p256dh : '',
                  auth: sub ? sub.auth : '',
                  subscription_status: sub ? sub.status : 'inactive'
                });
              }
            });
            return res;
          }

          // SELECT d.id, d.application_id... FROM notification_deliveries d ORDER BY d.created_at DESC LIMIT 10
          if (normalizedSql.includes('FROM notification_deliveries d ORDER BY d.created_at DESC LIMIT 10')) {
            return Array.from(tables.notification_deliveries.values())
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .slice(0, 10);
          }

          return [];
        }
      };
    }
  };
}

module.exports = {
  createDatabase
};
