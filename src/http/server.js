const http = require('node:http');

function createServer(router) {
  const server = http.createServer((req, res) => {
    router.handleRequest(req, res);
  });

  return server;
}

module.exports = {
  createServer
};
