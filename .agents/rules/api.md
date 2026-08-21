# API Rules

## Versioning

All application APIs must use:

```text
/v1
```

Example:

```text
POST /v1/notifications/send
```

---

# Authentication

Protected endpoints must require application authentication.

Example:

```http
Authorization: Bearer <application-token>
```

Never expose notification delivery without authentication.

---

# Subscription Endpoints

Recommended:

```text
POST   /v1/subscriptions
DELETE /v1/subscriptions/:id
```

---

# Presence Endpoints

Recommended:

```text
POST /v1/presence/heartbeat
POST /v1/presence/logout
```

---

# Notification Endpoint

Recommended:

```text
POST /v1/notifications/send
```

The request should identify:

```text
application
target
notification
```

Example:

```json
{
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

---

# Health Endpoint

The health endpoint should be:

```text
GET /health
```

It should not require application authentication.

Do not expose sensitive configuration through health responses.

---

# Request Validation

Reject:

- Invalid JSON
- Unsupported methods
- Unknown target types
- Missing required fields
- Invalid subscription objects
- Oversized payloads
- Unauthorized applications

---

# HTTP Responses

Use appropriate status codes.

Examples:

```text
200 OK
201 Created
202 Accepted
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
500 Internal Server Error
503 Service Unavailable
```

Do not return internal stack traces to clients.

---

# Error Format

Use a consistent JSON structure.

Example:

```json
{
  "error": {
    "code": "INVALID_TARGET",
    "message": "The notification target is invalid."
  }
}
```

Internal details should remain in logs.