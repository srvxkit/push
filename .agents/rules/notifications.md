# Notification Rules

## Notification Responsibility

`api.domain.com` decides:

```text
what happened
who should be notified
what notification should say
```

The notification server decides:

```text
which subscriptions are eligible
how to deliver
whether delivery succeeded
```

---

# Target Types

Initial supported targets:

```text
admin
user
users
admins
```

Do not silently support unknown target types.

---

# Admin Notification

For:

```text
target.type = admin
```

the notification server must:

1. Find the specified admin.
2. Find active subscriptions.
3. Find active presence/session for those subscriptions.
4. Deliver only to eligible subscriptions.

Required condition:

```text
subscription active
AND
presence active
```

---

# Admin Example

```text
Admin #5
├── Desktop
│   ├── subscribed
│   └── logged in
│       → SEND
│
├── Laptop
│   ├── subscribed
│   └── logged out
│       → DO NOT SEND
│
└── Mobile
    └── not subscribed
        → DO NOT SEND
```

---

# User Notification

For:

```text
target.type = user
```

resolve all eligible subscriptions belonging to that user.

A user may have multiple devices.

---

# Multiple Users

For:

```text
target.type = users
```

resolve each user independently.

A failure for one user must not prevent delivery to other users.

---

# Notification Payload

Keep payloads small.

Prefer:

```json
{
  "type": "comment.created",
  "id": "123"
}
```

instead of sending entire database objects.

The browser can retrieve additional information from the API.

---

# Idempotency

Notification jobs should support an idempotency identifier.

A retry of the same job must not unintentionally create duplicate notifications.

---

# Delivery Result

Each delivery should have a clear result:

```text
sent
failed
expired
```

A permanently invalid subscription should be deactivated or removed.

---

# Delivery Isolation

If one subscription fails:

```text
Subscription A → success
Subscription B → failure
Subscription C → success
```

A and C must still be delivered.

Do not fail the entire notification because of one subscription.