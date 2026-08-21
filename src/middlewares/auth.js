const apiKeyModel = require('../models/ApiKey');

const authAPIKey = async (req, res, next) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname.replace(/\/$/, '');

  // Public GET endpoints and application creation pass through
  if (req.method === 'GET' || pathname === '/v1/applications' || pathname === '/api/applications') {
    return await next();
  }

  const headers = req.headers || {};
  const authHeader = headers['authorization'] || '';
  const apiKey =
    headers['x-api-key'] ||
    headers['x-application-key'] ||
    (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader);

  if (!apiKey || !apiKey.trim()) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'UNAUTHORIZED', message: 'API key required' }));
    return;
  }

  const record = apiKeyModel.find(apiKey.trim());

  if (!record) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'UNAUTHORIZED', message: 'Invalid API key' }));
    return;
  }

  // Attach key details for downstream handlers
  req.apiKey = {
    id: record.id,
    name: record.name,
    owner: record.owner,
    scopes: record.scopes,
    createdAt: record.createdAt
  };
  req.application = req.apiKey;

  await next();
};

module.exports = authAPIKey;
