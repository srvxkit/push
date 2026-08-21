const { NotFoundError, AppError } = require('../errors/AppError');

class Router {
  constructor({ healthController, webhookController, dashboardController, env = {} }) {
    this.healthController = healthController;
    this.webhookController = webhookController;
    this.dashboardController = dashboardController;
    this.env = env;
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    // Set CORS Headers for all responses
    this._setCorsHeaders(req, res);

    // Handle OPTIONS Preflight Requests
    if (method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    try {
      // 1. Public Health Route
      if (method === 'GET' && pathname === '/health') {
        return await this.healthController.getHealth(req, res);
      }

      // 2. Public Dashboard UI & Telemetry Stats (if enabled)
      if (this.env.DASHBOARD_ENABLED) {
        const dashboardPath = (this.env.DASHBOARD_PATH || '/dashboard').replace(/\/$/, '');
        const normalizedPath = pathname.replace(/\/$/, '');

        if (method === 'GET' && (normalizedPath === dashboardPath || pathname === dashboardPath)) {
          return await this.dashboardController.getDashboardPage(req, res);
        }

        if (method === 'GET' && pathname === '/v1/stats') {
          return await this.dashboardController.getStats(req, res);
        }
      }

      // 3. Protected CI4 Notification Webhook Endpoints
      if (method === 'POST' && (pathname === '/v1/notifications/send' || pathname === '/webhook/send')) {
        return await this.webhookController.send(req, res);
      }

      throw new NotFoundError(`Endpoint ${method} ${pathname} not found`);
    } catch (err) {
      this._handleError(err, req, res);
    }
  }

  _setCorsHeaders(req, res) {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Application-Key');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  _handleError(err, req, res) {
    if (res.headersSent) return;

    this._setCorsHeaders(req, res);

    const statusCode = err instanceof AppError ? err.statusCode : 500;
    const errorCode = err instanceof AppError ? err.errorCode : 'INTERNAL_SERVER_ERROR';
    const message = err instanceof AppError ? err.message : 'Internal server error';

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: errorCode,
      message
    }));
  }
}

module.exports = Router;
