# Subscription Rules

## Subscription Meaning

A subscription means:

> A browser/device has granted permission to receive Web Push notifications.

It does not mean:

> The owner is currently logged in.

---

# Multiple Subscriptions

An owner can have multiple subscriptions.

Example:

```text
Admin #5
├── Chrome Desktop
├── Chrome Laptop
└── Android
```

Never enforce one subscription per owner.

---

# Subscription Data

A subscription should contain information similar to:

```text
id
application_id
owner_type
owner_id
device_id
endpoint
p256dh
auth
status
created_at
updated_at
```

Do not store unnecessary browser information.

---

# Admin Subscription

The admin dashboard should:

1. Register the service worker.
2. Request notification permission.
3. Create the browser push subscription.
4. Send the subscription to the notification server.
5. Establish active presence.
6. Send heartbeat updates.
7. End presence on logout.

---

# Subscription Registration Security

The notification server must verify that the authenticated application is authorized to register the subscription for the specified owner.

Never trust an arbitrary:

```text
owner_id
```

from an unauthenticated client.

---

# Logout

Logout should normally deactivate the active presence/session.

It should not necessarily delete the push subscription.

Example:

```text
Logout
  ↓
Presence inactive
  ↓
Subscription remains registered
```

On the next login:

```text
Login
  ↓
Presence active
  ↓
Existing subscription becomes eligible again
```

---

# Invalid Subscriptions

When the push service reports that a subscription is permanently invalid:

```text
mark inactive
```

or remove it according to the retention policy.

Do not repeatedly retry permanently invalid subscriptions.