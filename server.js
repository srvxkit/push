const http = require('node:http');
const path = require('node:path');
const config = require('./src/config');
const router = require('./src/router');
const { MiddlewareManager, middleware } = require('./src/middlewares');
const authAPIKey = require('./src/middlewares/auth');

class Server {
  constructor() {
    this.server = http.createServer(this.handleRequest.bind(this));
    this.middlewareManager = new MiddlewareManager();
    this.setupMiddlewares();
  }

  setupMiddlewares() {
    // Standard middlewares
    this.middlewareManager.use(middleware.logger);
    this.middlewareManager.use(middleware.cors);
    this.middlewareManager.use(middleware.bodyParser);
    this.middlewareManager.use(middleware.serveStatic(path.join(__dirname, 'public')));

    // Auth middleware
    this.middlewareManager.use(authAPIKey);
  }

  async handleRequest(req, res) {
    try {
      const shouldContinue = await this.middlewareManager.execute(req, res);

      if (!shouldContinue || res.writableEnded) {
        return;
      }

      await router.route(req, res);
    } catch (error) {
      console.error('[Server Error]', error);
      if (!res.writableEnded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'SERVER_ERROR', message: error.message }));
      }
    }
  }

  start() {
    // cPanel Passenger socket vs TCP listener
    if (typeof config.server.port === 'string' && (config.server.port === 'passenger' || config.server.port.startsWith('/') || config.server.port.startsWith('\\\\'))) {
      this.server.listen(config.server.port, () => {
        console.log(`[Push Server] Running on cPanel Passenger socket: ${config.server.port}`);
      });
    } else {
      this.server.listen(config.server.port, config.server.host, () => {
        console.log(`[Push Server] Running at http://${config.server.host}:${config.server.port}`);
      });
    }

    return this.server;
  }
}

module.exports = Server;
