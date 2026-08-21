const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../../../package.json');

class DashboardController {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
    this.htmlPath = path.resolve(__dirname, '../../../public/dashboard.html');
  }

  getStats(req, res) {
    const stats = this.deliveryRepository.getStats();
    stats.version = pkg.version || '1.0.0';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: stats }));
  }

  getDashboardPage(req, res) {
    if (!fs.existsSync(this.htmlPath)) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Dashboard template file missing');
    }

    let html = fs.readFileSync(this.htmlPath, 'utf8');
    html = html.replace('v-.-.-', 'v' + (pkg.version || '1.0.0'));

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }
}

module.exports = DashboardController;
