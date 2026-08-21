const NotificationLog = require('../models/NotificationLog');
const ApiKey = require('../models/ApiKey');
const config = require('../config');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class HealthController {
  async getHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'notification-server',
      timestamp: new Date().toISOString()
    }));
  }

  async getStats(req, res) {
    const stats = NotificationLog.getStats(ApiKey);
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    let version = '1.2.0';
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        version = pkg.version || version;
      } catch (e) {}
    }
    stats.version = version;
    stats.vapidPublicKey = config.webPush.public || '';

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: stats }));
  }

  async createApplication(req, res) {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const customToken = String(body.token || body.apiKey || '').trim();

    if (!name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: false, error: 'INVALID_INPUT', message: 'Application name is required.' }));
    }

    const rawKey = customToken || `app_key_${crypto.randomBytes(24).toString('hex')}`;
    const appId = `app_${crypto.randomBytes(8).toString('hex')}`;

    try {
      ApiKey.save({
        id: appId,
        name,
        key: rawKey
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: true,
        application: {
          id: appId,
          name,
          apiKey: rawKey,
          created_at: new Date().toISOString()
        },
        message: 'Application created successfully.'
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'DUPLICATE_NAME',
        message: err.message
      }));
    }
  }

  async getDashboardPage(req, res) {
    const htmlPath = path.resolve(process.cwd(), 'public/dashboard.html');
    const fallbackPath = path.resolve(process.cwd(), 'public/index.html');
    const targetFile = fs.existsSync(htmlPath) ? htmlPath : fallbackPath;

    if (!fs.existsSync(targetFile)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Dashboard template file missing');
    }

    const pkgPath = path.resolve(process.cwd(), 'package.json');
    let version = '1.2.0';
    if (fs.existsSync(pkgPath)) {
      try { version = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || version; } catch (e) {}
    }

    let html = fs.readFileSync(targetFile, 'utf8');
    html = html.replace(/v-\.-\.-/g, 'v' + version);
    html = html.replace(/{{VAPID_PUBLIC_KEY}}/g, config.webPush.public || '');

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
}

module.exports = new HealthController();
