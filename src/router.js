const PushController = require('./controllers/PushController');
const HealthController = require('./controllers/HealthController');
const config = require('./config');

class Router {
  constructor() {
    this.routes = {
      POST: {},
      GET: {},
      DELETE: {},
      PUT: {}
    };

    this.initRoutes();
  }

  initRoutes() {
    // Health & Telemetry
    this.get('/health', HealthController.getHealth.bind(HealthController));
    this.get('/api/vapid-public-key', PushController.getVapidKey.bind(PushController));

    if (config.dashboard.enabled) {
      const dbPath = config.dashboard.path || '/dashboard';
      this.get(dbPath, HealthController.getDashboardPage.bind(HealthController));
      this.get(`${dbPath}/`, HealthController.getDashboardPage.bind(HealthController));
      this.get('/v1/stats', HealthController.getStats.bind(HealthController));
    }

    // Application Management Endpoint
    this.post('/v1/applications', HealthController.createApplication.bind(HealthController));
    this.post('/api/applications', HealthController.createApplication.bind(HealthController));

    // CI4 & Webhook Notification Endpoints
    this.post('/v1/notifications/send', PushController.send.bind(PushController));
    this.post('/webhook/send', PushController.send.bind(PushController));
    this.post('/api/send-notification', PushController.send.bind(PushController));
    this.post('/api/broadcast', PushController.broadcast.bind(PushController));
  }

  post(path, handler) { this.routes.POST[path] = handler; }
  get(path, handler) { this.routes.GET[path] = handler; }
  delete(path, handler) { this.routes.DELETE[path] = handler; }
  put(path, handler) { this.routes.PUT[path] = handler; }

  async route(req, res) {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const query = {};
    reqUrl.searchParams.forEach((val, key) => { query[key] = val; });
    req.query = query;

    const pathname = reqUrl.pathname.replace(/\/$/, '') || '/';
    const method = req.method;

    let handler = this.routes[method] && (this.routes[method][pathname] || this.routes[method][reqUrl.pathname]);

    if (handler) {
      try {
        await handler(req, res);
      } catch (error) {
        console.error('[Controller Error]', error);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'SERVER_ERROR', message: error.message }));
        }
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'NOT_FOUND', message: `Endpoint ${method} ${reqUrl.pathname} not found` }));
    }
  }
}

module.exports = new Router();
