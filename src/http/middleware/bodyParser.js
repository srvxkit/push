const { ValidationError, PayloadTooLargeError } = require('../../errors/AppError');

function parseJsonBody(req, maxSizeBytes = 1048576) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return reject(new ValidationError('Content-Type must be application/json'));
    }

    let body = '';
    let bytesReceived = 0;

    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > maxSizeBytes) {
        req.destroy();
        return reject(new PayloadTooLargeError('Request body exceeds maximum size limit'));
      }
      body += chunk.toString('utf8');
    });

    req.on('end', () => {
      if (!body.trim()) {
        return resolve({});
      }

      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(new ValidationError('Invalid JSON body payload'));
      }
    });

    req.on('error', err => {
      reject(err);
    });
  });
}

module.exports = {
  parseJsonBody
};
