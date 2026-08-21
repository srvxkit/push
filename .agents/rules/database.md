# Database Rules

## Responsibility

Database repositories handle persistence.

Services handle business rules.

Controllers must not execute database queries directly.

---

# Application

Applications should have isolated records.

Example:

```text
applications
------------
id
name
credential_hash
status
created_at
updated_at
```

---

# Subscriptions

Recommended structure:

```text
subscriptions
--------------
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

---

# Presence

Recommended structure:

```text
presence
--------
id
application_id
subscription_id
owner_type
owner_id
session_id
last_seen_at
expires_at
```

---

# Delivery

Recommended structure:

```text
notification_deliveries
-----------------------
id
application_id
notification_id
subscription_id
owner_type
owner_id
status
attempts
last_error
created_at
sent_at
```

---

# Ownership

Every subscription must belong to exactly one application.

Every delivery must belong to exactly one application.

Never allow cross-application subscription access.

---

# Identifiers

Do not assume user/admin IDs are integers.

The API may use:

```text
123
"123"
"usr_123"
"admin_abc"
```

Treat external owner identifiers as opaque values.

---

# Repository Pattern

Example:

```text
SubscriptionRepository
PresenceRepository
DeliveryRepository
ApplicationRepository
```

Repositories should not contain notification business rules.

---

# Transactions

Use database transactions where necessary for operations that must be atomic.

Avoid unnecessary transactions around external Web Push requests.

External network calls should not hold database transactions open.