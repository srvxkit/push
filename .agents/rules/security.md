# Security Rules

## Authentication

Every application-to-notification-server endpoint must authenticate the calling application.

---

# Authorization

Authentication is not sufficient.

Verify that the application is authorized to perform the requested operation.

---

# Owner Protection

A client must not be able to register:

```text
admin:999
```

unless the authenticated application has verified that ownership.

---

# Secrets

Never commit:

```text
API keys
VAPID private key
database credentials
session secrets
production .env
```

Use:

```text
process.env
```

for secrets.

---

# Environment Configuration

Load `.env` once during application startup using `dotenv`.

Do not distribute environment loading across modules.

---

# Logging

Never log:

```text
Authorization headers
API keys
VAPID private keys
Push authentication secrets
```

Logs should use identifiers:

```text
application_id
notification_id
subscription_id
owner_id
```

where appropriate.

---

# Input Limits

Set reasonable limits for:

- HTTP request body
- notification title
- notification body
- notification data
- URL
- subscription fields

Never allow unlimited request bodies.

---

# HTTPS

Production communication must use HTTPS.

Sensitive API endpoints must never depend on plaintext HTTP in production.

---

# Web Push Cryptography

Do not implement cryptographic algorithms manually.

Use the `web-push` package for Web Push cryptography and delivery.

Node's `crypto` module may still be used for unrelated security operations such as hashing application credentials.