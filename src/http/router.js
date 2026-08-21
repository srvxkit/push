const { AppError, NotFoundError } = require('../errors/AppError');

class Router {
  constructor({ healthController, subscriptionController, presenceController, notificationController, dashboardController, env = {} }) {
    this.healthController = healthController;
    this.subscriptionController = subscriptionController;
    this.presenceController = presenceController;
    this.notificationController = notificationController;
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
      if (method === 'GET' && pathname === '/health') {
        return await this.healthController.getHealth(req, res);
      }

      // Conditional Dashboard UI & Telemetry routes
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

      if (method === 'GET' && pathname === '/v1/subscriptions') {
        const queryParams = {
          owner_type: url.searchParams.get('owner_type'),
          owner_id: url.searchParams.get('owner_id')
        };
        return await this.subscriptionController.list(req, res, queryParams);
      }

      if (method === 'POST' && pathname === '/v1/subscriptions') {
        return await this.subscriptionController.create(req, res);
      }

      if (method === 'DELETE' && pathname.startsWith('/v1/subscriptions/')) {
        const id = pathname.substring('/v1/subscriptions/'.length);
        if (id) {
          return await this.subscriptionController.remove(req, res, { id });
        }
      }

      if (method === 'POST' && pathname === '/v1/presence/heartbeat') {
        return await this.presenceController.heartbeat(req, res);
      }

      if (method === 'POST' && pathname === '/v1/presence/logout') {
        return await this.presenceController.logout(req, res);
      }

      if (method === 'POST' && pathname === '/v1/notifications/send') {
        return await this.notificationController.send(req, res);
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
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
      error: {
        code: errorCode,
        message
      }
    }));
  }
}

module.exports = Router;
