# Implementation Plan - Centralized Web Push Notification Server

Initialize and construct the Centralized Web Push Notification Server strictly adhering to `AGENTS.md` and all `.agents/rules/` directives.

## User Review Required

> [!IMPORTANT]
> **Database Driver & Node v16 Compatibility**
> To support Node v16 (where `node:sqlite` core module is unavailable), we will use an external SQLite library. `better-sqlite3` (or `sqlite3`) will be installed as an approved dependency alongside `web-push` and `dotenv`.
>
> All database access is encapsulated within `src/repositories/` so that business logic remains completely independent of the underlying storage engine.

## Open Questions

> [!NOTE]
> **SQLite Driver Preference**:
> We recommend `better-sqlite3` for its clean, synchronous API and reliable performance in Node.js applications. Alternatively, we can use `sqlite3` (async callbacks/promises) or a zero-dependency file-based storage engine via `node:fs`. Please confirm if `better-sqlite3` is your preferred package.

---

## Proposed Component Implementation Plan

### 1. Project Initialization & Dependencies
- Create `package.json` with approved dependencies (`web-push`, `dotenv`, and `better-sqlite3` or `sqlite3`).
- Create `.env.example` with configuration settings (`PORT`, `DATABASE_PATH`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, etc.).
- Create startup bootstrap entry point (`src/index.js`).

#### [NEW] [package.json](file:///G:/srvkit-node-push/package.json)
#### [NEW] [.env.example](file:///G:/srvkit-node-push/.env.example)
#### [NEW] [src/index.js](file:///G:/srvkit-node-push/src/index.js)

---

### 2. Configuration, Database & Repositories
- `src/config/env.js`: Singleton config loader using `dotenv`.
- `src/db/database.js`: SQLite database connection initializer.
- `storage/migrations/001_initial_schema.sql`: DDL migrations for `applications`, `subscriptions`, `presence`, and `notification_deliveries`.
- Repositories:
  - `src/repositories/ApplicationRepository.js`
  - `src/repositories/SubscriptionRepository.js`
  - `src/repositories/PresenceRepository.js`
  - `src/repositories/DeliveryRepository.js`

#### [NEW] [src/config/env.js](file:///G:/srvkit-node-push/src/config/env.js)
#### [NEW] [src/db/database.js](file:///G:/srvkit-node-push/src/db/database.js)
#### [NEW] [storage/migrations/001_initial_schema.sql](file:///G:/srvkit-node-push/storage/migrations/001_initial_schema.sql)
#### [NEW] [src/repositories/ApplicationRepository.js](file:///G:/srvkit-node-push/src/repositories/ApplicationRepository.js)
#### [NEW] [src/repositories/SubscriptionRepository.js](file:///G:/srvkit-node-push/src/repositories/SubscriptionRepository.js)
#### [NEW] [src/repositories/PresenceRepository.js](file:///G:/srvkit-node-push/src/repositories/PresenceRepository.js)
#### [NEW] [src/repositories/DeliveryRepository.js](file:///G:/srvkit-node-push/src/repositories/DeliveryRepository.js)

---

### 3. Authentication & Security
- `src/auth/AuthService.js`: Hashes credentials using `node:crypto`, authenticates applications by Bearer token.
- `src/errors/AppError.js`: Standardized application and HTTP error classes.

#### [NEW] [src/auth/AuthService.js](file:///G:/srvkit-node-push/src/auth/AuthService.js)
#### [NEW] [src/errors/AppError.js](file:///G:/srvkit-node-push/src/errors/AppError.js)

---

### 4. Push Service Layer (Boundary)
- `src/push/WebPushService.js`: The **ONLY** file importing `web-push`. Wraps push dispatch, error classification (transient vs permanent 404/410), VAPID credential setup.

#### [NEW] [src/push/WebPushService.js](file:///G:/srvkit-node-push/src/push/WebPushService.js)

---

### 5. Services & Business Logic
- `src/subscriptions/SubscriptionService.js`: Register, list, and deactivate Web Push subscriptions.
- `src/presence/PresenceService.js`: Manage session heartbeats, logins, and logouts.
- `src/notifications/NotificationService.js`: Accept notification requests, enforce admin presence rule (`active subscription` + `active presence`), handle user multi-device targeting, handle `users` / `admins` target resolution, and insert delivery jobs.

#### [NEW] [src/subscriptions/SubscriptionService.js](file:///G:/srvkit-node-push/src/subscriptions/SubscriptionService.js)
#### [NEW] [src/presence/PresenceService.js](file:///G:/srvkit-node-push/src/presence/PresenceService.js)
#### [NEW] [src/notifications/NotificationService.js](file:///G:/srvkit-node-push/src/notifications/NotificationService.js)

---

### 6. HTTP Router, Middleware & Controllers
- `src/http/router.js`: Lightweight HTTP router using `node:http`. Parses URL, HTTP method, and query parameters.
- `src/http/middleware/bodyParser.js`: Helper to stream and parse JSON payloads with size limit enforcement.
- Controllers:
  - `src/http/controllers/HealthController.js`: `/health` endpoint.
  - `src/http/controllers/SubscriptionController.js`: `POST /v1/subscriptions`, `DELETE /v1/subscriptions/:id`.
  - `src/http/controllers/PresenceController.js`: `POST /v1/presence/heartbeat`, `POST /v1/presence/logout`.
  - `src/http/controllers/NotificationController.js`: `POST /v1/notifications/send`.
- `src/http/server.js`: HTTP server instance launcher using `node:http`.

#### [NEW] [src/http/router.js](file:///G:/srvkit-node-push/src/http/router.js)
#### [NEW] [src/http/middleware/bodyParser.js](file:///G:/srvkit-node-push/src/http/middleware/bodyParser.js)
#### [NEW] [src/http/controllers/HealthController.js](file:///G:/srvkit-node-push/src/http/controllers/HealthController.js)
#### [NEW] [src/http/controllers/SubscriptionController.js](file:///G:/srvkit-node-push/src/http/controllers/SubscriptionController.js)
#### [NEW] [src/http/controllers/PresenceController.js](file:///G:/srvkit-node-push/src/http/controllers/PresenceController.js)
#### [NEW] [src/http/controllers/NotificationController.js](file:///G:/srvkit-node-push/src/http/controllers/NotificationController.js)
#### [NEW] [src/http/server.js](file:///G:/srvkit-node-push/src/http/server.js)

---

### 7. Delivery Worker Process
- `worker/notification-worker.js`: Background delivery job processing with job claiming locks, exponential backoff retries, permanent error cleanup (`inactive` subscription status update), and graceful shutdown handling (`SIGTERM`/`SIGINT`).

#### [NEW] [worker/notification-worker.js](file:///G:/srvkit-node-push/worker/notification-worker.js)

---

### 8. Testing Suite
- Native test suite (compatible with standard Node testing).
- `tests/auth/auth.test.js`: Validates app tokens, invalid credentials, unauthorized access.
- `tests/subscriptions/subscription.test.js`: Validates creation, deletion, multi-device, cross-app isolation.
- `tests/presence/presence.test.js`: Validates heartbeat, login, logout, expiration.
- `tests/notifications/admin_eligibility.test.js`: Tests mandatory admin states.
- `tests/notifications/user_targeting.test.js`: Tests multi-device user delivery and target types (`user`, `users`, `admin`, `admins`).
- `tests/worker/worker.test.js`: Tests background delivery worker, job claiming, retries, and invalid subscription cleanup.

#### [NEW] [tests/auth/auth.test.js](file:///G:/srvkit-node-push/tests/auth/auth.test.js)
#### [NEW] [tests/subscriptions/subscription.test.js](file:///G:/srvkit-node-push/tests/subscriptions/subscription.test.js)
#### [NEW] [tests/presence/presence.test.js](file:///G:/srvkit-node-push/tests/presence/presence.test.js)
#### [NEW] [tests/notifications/admin_eligibility.test.js](file:///G:/srvkit-node-push/tests/notifications/admin_eligibility.test.js)
#### [NEW] [tests/notifications/user_targeting.test.js](file:///G:/srvkit-node-push/tests/notifications/user_targeting.test.js)
#### [NEW] [tests/worker/worker.test.js](file:///G:/srvkit-node-push/tests/worker/worker.test.js)

---

## Verification Plan

### Automated Tests
1. Run test suite:
   ```bash
   node tests/run.js
   ```
2. Verify dependency compliance in `package.json` (`web-push`, `dotenv`, and `sqlite3`/`better-sqlite3`).

### Manual Verification
1. Start server and worker.
2. Execute curl/HTTP requests to `/health`, `/v1/subscriptions`, `/v1/presence/heartbeat`, `/v1/presence/logout`, `/v1/notifications/send`.
