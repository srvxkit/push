const fs = require('node:fs');
const path = require('node:path');

class MiddlewareManager {
  constructor() {
    this.middlewares = [];
  }

  use(middleware) {
    this.middlewares.push(middleware);
  }

  async execute(req, res) {
    let index = 0;
    const middlewares = this.middlewares;

    const next = async () => {
      if (index < middlewares.length) {
        const fn = middlewares[index++];
        try {
          await fn(req, res, next);
        } catch (err) {
          console.error('[Middleware Error]', err);
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'SERVER_ERROR', message: err.message }));
          }
        }
      }
      return true;
    };

    await next();
    return !res.writableEnded;
  }
}

const middleware = {
  logger: async (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    await next();
  },

  cors: async (req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, X-Application-Key');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    await next();
  },

  bodyParser: async (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
      await new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString('utf8');
        });
        req.on('end', () => {
          try {
            req.body = body.trim() ? JSON.parse(body) : {};
          } catch (e) {
            req.body = {};
          }
          resolve();
        });
        req.on('error', () => {
          req.body = {};
          resolve();
        });
      });
    }
    await next();
  },

  serveStatic: (root) => {
    return async (req, res, next) => {
      if (req.method !== 'GET') {
        return await next();
      }

      const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const p = reqUrl.pathname.toLowerCase();

      // Pass dashboard pages through to HealthController to pre-render dynamic VAPID & version tags
      if (p === '/' || p === '/dashboard' || p === '/dashboard/' || p === '/dashboard.html' || p === '/index.html') {
        return await next();
      }

      const sanitizePath = path.normalize(reqUrl.pathname).replace(/^(\.\.[\/\\])+/, '');
      let pathname = path.join(root, sanitizePath);

      try {
        const stats = await fs.promises.stat(pathname);

        if (stats.isDirectory()) {
          pathname = path.join(pathname, 'index.html');
          const indexStats = await fs.promises.stat(pathname);
          if (indexStats.isFile()) {
            await streamFile(pathname, res);
            return;
          }
          return await next();
        } else if (stats.isFile()) {
          await streamFile(pathname, res);
          return;
        } else {
          await next();
        }
      } catch (err) {
        return await next();
      }
    };
  }
};

function streamFile(pathname, res) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(pathname).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(pathname);
    stream.pipe(res);
    stream.on('end', resolve);
    stream.on('error', reject);
    res.on('finish', resolve);
  });
}

module.exports = { MiddlewareManager, middleware };
