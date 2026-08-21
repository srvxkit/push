# Architecture Rules

## Responsibility Boundary

The architecture has a strict boundary.

### `api.domain.com`

Owns:

```text
Business events
Business logic
Notification decisions
Notification jobs
Notification content
Target selection
```

### Notification Server

Owns:

```text
Application authentication
Subscriptions
Presence
Delivery eligibility
Web Push
Delivery status
Retries
Subscription cleanup
```

---

# Event Flow

```text
Business Event
      ↓
api.domain.com
      ↓
Existing Job Queue
      ↓
Notification Job
      ↓
Notification Server API
      ↓
Resolve subscriptions
      ↓
Check eligibility
      ↓
Web Push
```

---

# Do Not Duplicate Business Logic

The notification server must never determine:

```text
Should this event notify someone?
```

That decision belongs to `api.domain.com`.

The notification server determines:

```text
Can this notification currently be delivered to this target?
```

---

# Service Structure

Use:

```text
Controller
    ↓
Service
    ↓
Repository
```

For push:

```text
NotificationService
    ↓
WebPushService
    ↓
web-push
```

For subscriptions:

```text
SubscriptionController
    ↓
SubscriptionService
    ↓
SubscriptionRepository
```

---

# HTTP Layer

The HTTP layer must remain thin.

A controller should:

1. Read request.
2. Validate basic request structure.
3. Authenticate.
4. Call a service.
5. Return a response.

Do not put SQL, push delivery, retry loops, or complex targeting logic directly inside route handlers.

---

# Application Isolation

Every resource should be scoped to an application.

Conceptually:

```text
Application A
├── Users
├── Admins
└── Subscriptions

Application B
├── Users
├── Admins
└── Subscriptions
```

Application A must never access Application B's subscriptions.

---

# Stateless HTTP

Do not depend on global mutable request state.

Services should receive the information they need explicitly.

---

# Directory Structure

Recommended:

```text
src/
├── auth/
├── http/
├── applications/
├── subscriptions/
├── presence/
├── notifications/
├── push/
├── repositories/
├── errors/
└── config/

worker/
└── notification-worker.js

storage/
└── migrations/

tests/
├── auth/
├── subscriptions/
├── presence/
├── notifications/
└── push/
```