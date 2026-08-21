# Stateless Web Push Server for CodeIgniter 4 (CI4)

A clean, stateless Web Push notification gateway built with Node.js.

Designed specifically to work with application servers such as **CodeIgniter 4 (CI4)**. CI4 acts as the single source of truth for push subscriptions and dispatches push delivery jobs directly to Node.js via `POST /v1/notifications/send`. Node.js delivers the Web Push notification using `web-push` and returns an immediate status response (`200 OK`, `410 Gone`, or `500 Internal Server Error`).

---

## Architecture & Flow

```text
1. Browser registers push subscription
   └── Saved in CI4 DB (`push_subscriptions` table)

2. Event occurs in CI4 (e.g. New Comment)
   └── `NotificationModel::dispatchToUser('42', ...)`

3. CI4 Queue Worker sends POST /v1/notifications/send to Node.js
   Headers: Authorization: Bearer <application_key>
   Body: Contains exact browser endpoint, p256dh, auth keys, and notification payload

4. Node.js executes webpush.sendNotification(subscription, notification)
   ├── 200 OK  ──► Notification delivered successfully
   ├── 410 Gone ─► Subscription expired/revoked (CI4 deactivates subscription)
   └── 500 ERR ──► Transient error (CI4 automatically retries via queue)
```

---

## Directory Structure

```text
app.js                       # Root entry point for cPanel Node.js Selector & Passenger

src/
├── auth/
│   └── AuthService.js       # Application key token hashing & lookup
├── config/
│   └── env.js               # Environment configuration loader
├── db/
│   └── database.js          # Direct JSON data persistence (storage/data.json)
├── errors/
│   └── AppError.js          # Standardized HTTP error format
├── http/
│   ├── controllers/
│   │   ├── DashboardController.js  # Telemetry stats controller
│   │   ├── HealthController.js     # Public /health check controller
│   │   └── WebhookController.js    # CI4 notification webhook handler
│   ├── middleware/
│   │   ├── bodyParser.js          # JSON stream payload reader
│   │   └── cryptoAuth.js          # Request-Verification crypto auth middleware
│   ├── router.js                  # Clean HTTP request router
│   └── server.js                  # Core Node.js HTTP server factory
├── push/
│   └── WebPushService.js          # Isolated web-push wrapper
└── index.js                      # Application server bootstrap

scripts/
├── app.js                   # CLI tool to create and list application keys
└── generate.js              # CLI tool to generate VAPID keys

storage/
└── data.json                # Plain human-readable JSON storage file for apps & telemetry

public/
└── dashboard.html           # Live Telemetry Dashboard UI

tests/
├── run.js                   # Test suite runner
└── webhook/
    └── webhook.test.js      # CI4 webhook integration tests
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure your settings:

```ini
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_PATH=./storage/data.json

# Web Push VAPID Configuration
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@example.com

# Timing & Limits
MAX_PAYLOAD_SIZE_BYTES=1048576

# Dashboard UI (Optional)
DASHBOARD_ENABLED=true
DASHBOARD_PATH=/dashboard
```

---

## Generating Application Credentials

Create an application key for CI4 authentication:

```bash
# Auto-generate an application key
npm run app -- --create --name "CodeIgniter 4 App"

# Or specify a custom application key
npm run app -- --create --name "CodeIgniter 4 App" --token "custom_secret_key"
```

Use the generated key in your CI4 HTTP request headers:

```http
Authorization: Bearer <your-application-key>
```
Or:
```http
X-Application-Key: <your-application-key>
```

---

## API Endpoints

### 1. Public Health Check
- **URL**: `GET /health`
- **Authentication**: None (Public)
- **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "service": "notification-server",
    "timestamp": "2026-08-22T00:00:00.000Z"
  }
  ```

---

### 2. CI4 Notification Webhook
- **URL**: `POST /v1/notifications/send` (or `POST /webhook/send`)
- **Headers**: `Authorization: Bearer <application-key>`
- **Payload**:
  ```json
  {
    "job_id": "101",
    "notification_id": "50",
    "idempotency_key": "job_notif_101",
    "target": {
      "type": "subscription",
      "id": "1"
    },
    "subscription": {
      "endpoint": "https://fcm.googleapis.com/fcm/send/...",
      "keys": {
        "p256dh": "BEl62iUY...",
        "auth": "5x0R92hP..."
      }
    },
    "notification": {
      "type": "comment.created",
      "title": "New Customer Inquiry",
      "body": "John Doe sent a message: I need help with billing.",
      "url": "/admin/contacts/991",
      "data": {
        "contact_id": "991"
      }
    }
  }
  ```
- **Responses**:
  - **Success (`200 OK`)**:
    ```json
    {
      "success": true,
      "job_id": "101",
      "delivery_id": "push_delv_1724288000_x9a8b7c6d",
      "status": "processed"
    }
    ```
  - **Expired / Revoked Subscription (`410 Gone`)**:
    ```json
    {
      "success": false,
      "job_id": "101",
      "error": "INVALID_SUBSCRIPTION",
      "message": "Push subscription expired or revoked."
    }
    ```
  - **Server Error (`500 Internal Server Error`)**:
    ```json
    {
      "success": false,
      "job_id": "101",
      "error": "SERVER_ERROR",
      "message": "Failed to deliver web push notification"
    }
    ```

---

## Testing

Run the native test suite:

```bash
npm test
```
