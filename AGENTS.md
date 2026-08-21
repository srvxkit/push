# AGENTS.md

# Centralized Notification Server

## Project Purpose

This project is a centralized Web Push notification server built with Node.js.

It receives notification requests from existing applications such as `api.domain.com` and delivers Web Push notifications to subscribed browsers.

The primary application remains responsible for business events and notification jobs.

The notification server is responsible for:

- Application authentication
- Subscription management
- Admin/user association
- Admin presence
- Notification targeting
- Web Push delivery
- Delivery status
- Retry handling
- Invalid subscription cleanup
- Logging

---

# 1. Core Architecture

The system consists of two major sides.

## Application Server

Example:

```text
api.domain.com
```

The application server is responsible for:

```text
Business Event
      ↓
Business Logic
      ↓
Notification Job
      ↓
Notification Server API
```

It determines:

- What happened
- Whether a notification should be created
- Who should receive it
- Notification title
- Notification body
- Notification URL
- Notification data

---

## Notification Server

The notification server receives an already-defined notification request.

It is responsible for:

```text
Authenticate
    ↓
Validate
    ↓
Resolve subscriptions
    ↓
Check delivery eligibility
    ↓
Send Web Push
    ↓
Record result
```

The notification server must not contain application-specific business logic.

---

# 2. Dependency Policy

Only two external npm packages are allowed:

```text
web-push
dotenv
```

Everything else must use Node.js core modules.

Do not add an npm package without explicit approval.

## `web-push`

Use `web-push` exclusively for:

- Web Push delivery
- VAPID
- Web Push encryption
- Push-service communication

Do not manually implement Web Push cryptography.

## `dotenv`

Use `dotenv` only for loading environment variables.

---

# 3. Node.js Core

Use Node.js built-in modules for all other functionality.

Examples:

```text
node:http
node:https
node:crypto
node:fs
node:path
node:url
node:stream
node:events
node:buffer
node:util
node:os
node:timers
```

Do not replace core functionality with npm packages.

---

# 4. Application-Agnostic Design

The notification server must not know application-specific concepts such as:

- Articles
- Comments
- Orders
- Payments
- Contact forms
- Products
- Application database models

It understands only:

```text
application
owner
subscription
presence
notification
delivery
```

---

# 5. Admin Notification Rule

Admin notifications have a strict eligibility requirement.

An admin receives a notification only when:

```text
Active subscription
+
Active logged-in session/presence
=
Eligible
```

A subscription alone is not enough.

For example:

```text
Admin subscribed
Admin logged out
       ↓
DO NOT SEND
```

Whereas:

```text
Admin subscribed
Admin logged in
Presence active
       ↓
SEND
```

---

# 6. User Notification Rule

Users can have multiple subscribed devices.

Example:

```text
User 123
├── Chrome Desktop
├── Android Chrome
└── Firefox Laptop
```

The notification server must support multiple subscriptions per user.

User delivery behavior is determined by the notification request and configured delivery rules.

---

# 7. Subscription vs Presence

These are separate concepts.

### Subscription

A browser/device has permission to receive Web Push.

### Presence

A browser/device currently has an authenticated active application session.

Never use subscription existence as proof of login.

---

# 8. Existing Job Queue

The existing queue in `api.domain.com` is the source of notification jobs.

Do not create a duplicate business-event queue inside the notification server.

Expected flow:

```text
api.domain.com
      ↓
Existing Job Queue
      ↓
Notification Job
      ↓
Notification Server
      ↓
Web Push
```

The notification server may have an internal delivery queue/worker for reliable push delivery, but it must not duplicate the application's business-event queue.

---

# 9. Multiple Applications

The notification server should support multiple applications.

Every request should identify the application.

Example:

```text
application_id
```

Application-specific credentials must be isolated.

A subscription must belong to an application.

---

# 10. HTTP Server

Do not use Express or another HTTP framework.

Use Node.js core:

```js
node:http
```

Implement a small internal router and HTTP abstraction.

Keep routing separate from business services.

Preferred structure:

```text
HTTP Request
    ↓
Router
    ↓
Controller
    ↓
Service
    ↓
Repository / Push Service
```

---

# 11. Web Push Boundary

Only the dedicated Web Push service should import `web-push`.

Example:

```text
src/
└── push/
    └── WebPushService.js
```

Architecture:

```text
NotificationService
       ↓
WebPushService
       ↓
web-push
       ↓
Browser Push Service
```

Do not use `web-push` directly from controllers or repositories.

---

# 12. Security

All application-to-notification-server requests must be authenticated.

Validate:

- Authentication
- Authorization
- HTTP method
- Content-Type
- JSON body
- Payload size
- Target type
- Owner ID
- Subscription data

Never trust client-provided owner IDs without authentication and authorization.

---

# 13. Secrets

Never commit:

- API keys
- VAPID private keys
- Database passwords
- Production credentials
- Session secrets

Use environment variables.

Example:

```text
.env
```

must not be committed.

---

# 14. Testing

Every important behavior must have tests.

At minimum test:

- Authentication
- Subscription registration
- Subscription removal
- Admin presence
- Admin notification eligibility
- User notification targeting
- Multiple devices
- Invalid subscriptions
- Retry behavior
- Web Push failures

---

# 15. Code Quality

Prefer:

- Small modules
- Single responsibility
- Explicit dependencies
- Async/await
- Clear error handling
- Descriptive names
- Minimal abstractions

Avoid:

- Large controllers
- Global mutable state
- Hidden side effects
- Business logic in routes
- Direct SQL inside controllers
- Direct `web-push` usage outside its service

---

# 16. Definition of Done

A feature is complete only when:

- It follows the architecture.
- It does not introduce an unauthorized dependency.
- Authentication is enforced.
- Input is validated.
- Errors are handled.
- Tests cover important behavior.
- Logs do not expose secrets.
- Invalid subscriptions are handled.
- Documentation is updated when necessary.