const { parseJsonBody } = require('../middleware/bodyParser');

class PresenceController {
  constructor(presenceService, authService, maxSizeBytes) {
    this.presenceService = presenceService;
    this.authService = authService;
    this.maxSizeBytes = maxSizeBytes;
  }

  async heartbeat(req, res) {
    const app = this.authService.authenticate(req.headers['authorization']);
    const body = await parseJsonBody(req, this.maxSizeBytes);
    const presence = this.presenceService.recordHeartbeat(app.id, body);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: presence
    }));
  }

  async logout(req, res) {
    const app = this.authService.authenticate(req.headers['authorization']);
    const body = await parseJsonBody(req, this.maxSizeBytes);
    this.presenceService.recordLogout(app.id, body);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Presence session logged out successfully'
    }));
  }
}

module.exports = PresenceController;
