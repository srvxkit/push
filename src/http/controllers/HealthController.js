class HealthController {
  getHealth(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'notification-server',
      timestamp: new Date().toISOString()
    }));
  }
}

module.exports = HealthController;
