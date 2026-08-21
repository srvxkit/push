const fs = require('node:fs');
const path = require('node:path');

class NotificationLogModel {
  constructor(dataFile = null) {
    this.dataFile = dataFile || path.resolve(process.cwd(), 'data/notifications.json');
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

  getAll() {
    if (this.dataFile === ':memory:') return this.memoryLogs || [];
    try {
      const raw = fs.readFileSync(this.dataFile, 'utf8').trim();
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveAll(logs) {
    if (this.dataFile === ':memory:') {
      this.memoryLogs = logs;
      return;
    }
    fs.writeFileSync(this.dataFile, JSON.stringify(logs, null, 2), 'utf8');
  }

  log({ id, applicationId, jobId, notificationId, idempotencyKey, target, subscription, notification, status, lastError = null }) {
    const logs = this.getAll();
    const now = new Date().toISOString();

    const record = {
      id: id || `push_delv_${Math.floor(Date.now() / 1000)}_${Math.random().toString(36).substring(2, 8)}`,
      application_id: applicationId || 'app_default',
      job_id: String(jobId || ''),
      notification_id: String(notificationId || ''),
      idempotency_key: idempotencyKey || null,
      target: target || null,
      subscription_endpoint: subscription ? subscription.endpoint : null,
      notification: notification || null,
      status,
      last_error: lastError,
      created_at: now,
      sent_at: status === 'processed' || status === 'sent' ? now : null
    };

    logs.push(record);
    this._saveAll(logs);
    return record;
  }

  getStats(apiKeyModel) {
    const logs = this.getAll();
    const apps = apiKeyModel ? apiKeyModel.getAll() : [];

    let sent = 0, failed = 0, invalid = 0;
    logs.forEach(n => {
      if (n.status === 'processed' || n.status === 'sent') sent++;
      else if (n.status === 'invalid_subscription' || n.status === 'expired') invalid++;
      else failed++;
    });

    const recentDeliveries = [...logs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10);

    return {
      applications: apps.length,
      applicationsList: apps.map(a => ({ id: a.id, name: a.name, status: a.active ? 'active' : 'inactive', created_at: a.createdAt })),
      subscriptions: { total: 0, active: 0, inactive: 0 },
      presence: { active: 0 },
      deliveries: {
        total: logs.length,
        sent,
        pending: 0,
        processing: 0,
        failed,
        expired: invalid
      },
      recentDeliveries
    };
  }
}

module.exports = new NotificationLogModel();
module.exports.NotificationLogModel = NotificationLogModel;
