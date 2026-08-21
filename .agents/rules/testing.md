# Testing Rules

## General

Every new feature must include tests for its important success and failure paths.

Tests should not require third-party testing libraries unless explicitly approved.

Use Node.js's built-in testing facilities where available.

---

# Authentication Tests

Test:

```text
valid credentials
invalid credentials
missing credentials
expired/disabled application
unauthorized application
```

---

# Subscription Tests

Test:

```text
create subscription
duplicate subscription
multiple devices
deactivate subscription
invalid subscription
cross-application access
```

---

# Presence Tests

Test:

```text
login/presence creation
heartbeat
presence refresh
presence expiration
logout
multiple devices
```

---

# Critical Admin Tests

These behaviors are mandatory.

### Logged in + subscribed

```text
subscription = active
presence = active

→ SEND
```

### Logged out + subscribed

```text
subscription = active
presence = inactive

→ DO NOT SEND
```

### Logged in + not subscribed

```text
subscription = missing

→ DO NOT SEND
```

### Logged out + not subscribed

```text
subscription = missing
presence = inactive

→ DO NOT SEND
```

---

# User Tests

Test:

```text
single user
multiple users
multiple devices
invalid device
mixed success/failure
```

---

# Worker Tests

Test:

```text
successful job
temporary failure
retry
maximum retries
permanent subscription failure
duplicate job
worker continuation after failure
```

---

# Web Push Tests

Test the `WebPushService` independently.

Verify:

```text
valid subscription
invalid subscription
push success
push failure
permanent failure
transient failure
```

Do not duplicate the internal cryptographic implementation of `web-push` in project tests.

---

# Security Tests

Verify:

```text
unauthenticated request rejected
unauthorized owner rejected
cross-application access rejected
oversized payload rejected
invalid JSON rejected
invalid target rejected
```

---

# Test Isolation

Tests should not depend on production data.

Use a dedicated test database/configuration.