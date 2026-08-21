# Centralized Web Push Notification Server

A lightweight, application-agnostic Web Push notification server built with Node.js.

The server receives notification requests from application servers (such as `api.domain.com`) and manages VAPID Web Push delivery, browser subscriptions, user/admin presence, retries, and invalid subscription cleanup.

---

## Key Features

- **Minimal Dependency Policy**: Built exclusively with Node.js built-in core modules (`node:http`, `node:sqlite`, `node:crypto`, `node:fs`, etc.) and only two approved external packages: `web-push` and `dotenv`.
- **Application-Agnostic Architecture**: Understands only applications, owners, subscriptions, presence, notifications, and deliveries without application-specific business domain concepts.
- **Strict Admin Notification Rule**: Admins receive notifications only when they possess an **active subscription** AND an **active logged-in session presence**. If an admin logs out, notifications are withheld until they log back in.
- **Multi-Device User Targeting**: Supports multiple subscribed devices per user, delivering notifications across all active registered subscriptions.
- **Web Push Service Boundary**: Isolated `WebPushService` handles all VAPID encryption and browser push service communication.
- **Automatic Subscription Cleanup**: Push errors indicating expired or invalid subscriptions (HTTP status `404`/`410`) automatically deactivate the subscription record.
- **Background Delivery Worker**: Dedicated worker process claims pending delivery jobs, executes retries with backoff, and guarantees fault isolation.
- **cPanel & Phusion Passenger Support**: Out-of-the-box support for cPanel Node.js Selector and Passenger unix socket listeners.

---

## Directory Structure

```text
app.js                    # Root entry point for cPanel Node.js Selector & Passenger

src/
├── auth/                 # Application Bearer token authentication & hashing
├── config/               # Environment loader (dotenv)
├── db/                   # SQLite database connection & initial migration execution
├── errors/               # Standardized API error format & status codes
├── http/
│   ├── controllers/      # Health, Subscription, Presence, Notification, Dashboard controllers
│   ├── middleware/       # JSON body parsing & payload size limit validation
│   ├── router.js         # Lightweight Node.js HTTP router
│   └── server.js         # HTTP server factory using node:http
├── notifications/        # Target resolution & Admin presence rule enforcement
├── presence/             # Active session heartbeat & logout management
├── push/                 # WebPushService wrapping web-push
├── repositories/         # Database persistence (Applications, Subscriptions, Presence, Deliveries)
├── subscriptions/        # Subscription registration & management
└── index.js              # Application HTTP server entry point

scripts/
├── app.js                # CLI tool to create, update, and list applications
├── generate.js           # CLI tool to generate VAPID keys
└── subscriptions.js      # CLI tool to list registered subscriptions

worker/
└── notification-worker.js # Background delivery worker process

storage/
└── migrations/           # DDL SQL migration scripts

tests/
├── auth/                 # Authentication tests
├── subscriptions/        # Subscription CRUD & cross-app isolation tests
├── presence/             # Presence heartbeat & logout tests
├── notifications/        # Admin eligibility rule & user multi-device targeting tests
├── http/                 # CORS & Dashboard UI tests
├── worker/               # Worker job claiming, retry, & expired subscription cleanup tests
└── run.js                # Native test suite runner
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure your settings:

```ini
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_PATH=./storage/push_server.db

# Web Push VAPID Configuration
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@example.com

# Timing & Limits
PRESENCE_TTL_SECONDS=300
MAX_PAYLOAD_SIZE_BYTES=1048576
MAX_RETRIES=3

# Dashboard UI (Optional)
DASHBOARD_ENABLED=true
DASHBOARD_PATH=/dashboard
```

---

## cPanel Deployment Guide

To deploy on cPanel via **Node.js Selector** (Phusion Passenger):

1. **Upload Repository**: Upload or clone the repository to your cPanel directory (e.g. `/home/username/push-server`).
2. **Create Node.js Application in cPanel**:
   - Go to **cPanel** -> **Setup Node.js App**.
   - **Node.js Version**: Select Node `20.x` or higher.
   - **Application Mode**: Select `Production`.
   - **Application Root**: `push-server` (or path where code is uploaded).
   - **Application URL**: Select your domain or subdomain (e.g. `push.yourdomain.com`).
   - **Application Startup File**: Enter `app.js`.
3. **Run NPM Install**:
   - In cPanel Node.js App manager, click **Run NPM Install** (or run `npm install` via SSH/Terminal).
4. **Environment File**:
   - Create your `.env` file in the application root folder with your VAPID keys.
5. **Restart Application**:
   - Click **Restart Application** in cPanel.

---

## CLI Management Scripts

All management utilities are integrated into clean npm scripts:

### 1. Generating Web Push VAPID Keys
Generate a new VAPID public/private keypair for `.env`:

```bash
npm run generate -- --vapid
```

---

### 2. Application Credentials Management

#### Create or Reset an Application Token
Create a new application token or reset an existing application's token:

```bash
# Auto-generate a random API token
npm run app -- --create --name "My Application"

# Or specify a custom API token
npm run app -- --create --name "My Application" --token "my-custom-secret-token"
```

Use the generated API token in your HTTP request headers:

```http
Authorization: Bearer <your-api-token>
```

#### List All Applications
List all registered applications:

```bash
npm run app -- --list
```

---

### 3. List Subscriptions CLI
List all registered push subscriptions in the database:

```bash
npm run subscriptions -- --list
```

---

## Getting Started

### Installation

Install dependencies:

```bash
npm install
```

### Running the HTTP Server

Start the API server:

```bash
npm start
```

The server listens on `http://localhost:3000`.

### Running the Delivery Worker

In a separate terminal process, run the delivery worker to process push notification jobs:

```bash
npm run worker
```

### Running Tests

Run the native test suite:

```bash
npm test
```

---

## API Documentation

All application endpoints require Bearer token authentication:

```http
Authorization: Bearer <application-token>
```

### 1. Health Check
Unauthenticated health verification endpoint.

- **URL**: `GET /health`
- **Response**: `200 OK`
  ```json
  {
    "status": "ok",
    "service": "notification-server",
    "timestamp": "2026-08-20T20:00:00.000Z"
  }
  ```

---

### 2. Register Subscription
Registers or updates a browser Web Push subscription.

- **URL**: `POST /v1/subscriptions`
- **Header**: `Authorization: Bearer <application-token>`
- **Body**:
  ```json
  {
    "owner_type": "user",
    "owner_id": "usr_123",
    "device_id": "chrome_desktop",
    "endpoint": "https://fcm.googleapis.com/fcm/send/...",
    "keys": {
      "p256dh": "BEl62iUY...",
      "auth": "tBCN..."
    }
  }
  ```
- **Response**: `201 Created`

---

### 3. List Subscriptions
Retrieves registered subscriptions for the calling application.

- **URL**: `GET /v1/subscriptions`
- **Query Params (Optional)**: `?owner_type=user&owner_id=usr_123`
- **Header**: `Authorization: Bearer <application-token>`
- **Response**: `200 OK`
  ```json
  {
    "data": [
      {
        "id": "sub_12345",
        "application_id": "app_main",
        "owner_type": "user",
        "owner_id": "usr_123",
        "device_id": "chrome_desktop",
        "endpoint": "https://fcm.googleapis.com/fcm/send/...",
        "status": "active",
        "created_at": "2026-08-20T20:00:00.000Z"
      }
    ],
    "total": 1
  }
  ```

---

### 4. Remove Subscription
Deletes a Web Push subscription by ID.

- **URL**: `DELETE /v1/subscriptions/:id`
- **Header**: `Authorization: Bearer <application-token>`
- **Response**: `200 OK`

---

### 5. Presence Heartbeat
Records an active logged-in application session.

- **URL**: `POST /v1/presence/heartbeat`
- **Header**: `Authorization: Bearer <application-token>`
- **Body**:
  ```json
  {
    "owner_type": "admin",
    "owner_id": "admin_5",
    "session_id": "sess_998877",
    "subscription_id": "sub_12345",
    "ttl_seconds": 300
  }
  ```
- **Response**: `200 OK`

---

### 6. Presence Logout
Deactivates an active session presence upon user/admin logout.

- **URL**: `POST /v1/presence/logout`
- **Header**: `Authorization: Bearer <application-token>`
- **Body**:
  ```json
  {
    "session_id": "sess_998877"
  }
  ```
- **Response**: `200 OK`

---

### 7. Send Notification Request
Submits a notification job to be queued and delivered via Web Push.

- **URL**: `POST /v1/notifications/send`
- **Header**: `Authorization: Bearer <application-token>`
- **Body Example (Admin Target)**:
  ```json
  {
    "idempotency_key": "job_01h8",
    "target": {
      "type": "admin",
      "id": "5"
    },
    "notification": {
      "type": "contact.created",
      "title": "New Contact Message",
      "body": "A new contact message has been received.",
      "url": "/admin/contacts/123",
      "data": {
        "id": "123"
      }
    }
  }
  ```
- **Supported Targets**:
  - `"admin"` (requires `target.id`)
  - `"user"` (requires `target.id`)
  - `"admins"` (requires `target.ids` array)
  - `"users"` (requires `target.ids` array)
- **Response**: `202 Accepted`

---

## Standard Error Format

All error responses adhere to a consistent JSON structure:

```json
{
  "error": {
    "code": "INVALID_TARGET",
    "message": "The notification target is invalid."
  }
}
```

Common error codes include: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_INPUT`, `INVALID_TARGET`, `PAYLOAD_TOO_LARGE`, and `INTERNAL_SERVER_ERROR`.
