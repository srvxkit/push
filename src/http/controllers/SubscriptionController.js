const { parseJsonBody } = require('../middleware/bodyParser');

class SubscriptionController {
  constructor(subscriptionService, authService, maxSizeBytes) {
    this.subscriptionService = subscriptionService;
    this.authService = authService;
    this.maxSizeBytes = maxSizeBytes;
  }

  async create(req, res) {
    const app = this.authService.authenticate(req.headers['authorization']);
    const body = await parseJsonBody(req, this.maxSizeBytes);
    const subscription = this.subscriptionService.registerSubscription(app.id, body);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: subscription
    }));
  }

  async list(req, res, queryParams = {}) {
    const app = this.authService.authenticate(req.headers['authorization']);
    const subscriptions = this.subscriptionService.listSubscriptions(app.id, {
      ownerType: queryParams.owner_type || null,
      ownerId: queryParams.owner_id || null
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: subscriptions,
      total: subscriptions.length
    }));
  }

  async remove(req, res, params) {
    const app = this.authService.authenticate(req.headers['authorization']);
    const subscriptionId = params.id;
    this.subscriptionService.removeSubscription(app.id, subscriptionId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      message: 'Subscription deleted successfully'
    }));
  }
}

module.exports = SubscriptionController;
