const { parseJsonBody } = require('../middleware/bodyParser');

class NotificationController {
  constructor(notificationService, authService, maxSizeBytes) {
    this.notificationService = notificationService;
    this.authService = authService;
    this.maxSizeBytes = maxSizeBytes;
  }

  async send(req, res) {
    const app = this.authService.authenticate(req.headers['authorization']);
    const body = await parseJsonBody(req, this.maxSizeBytes);
    const result = this.notificationService.processNotificationRequest(app.id, body);

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: result
    }));
  }
}

module.exports = NotificationController;
