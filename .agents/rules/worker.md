# Worker Rules

## Purpose

The worker is responsible for processing notification delivery jobs.

It must not process application business events.

---

# Flow

```text
Pending Job
    ↓
Claim Job
    ↓
Resolve Subscriptions
    ↓
Check Eligibility
    ↓
Send Push
    ↓
Record Result
```

---

# Job States

Use states such as:

```text
pending
processing
sent
failed
expired
```

---

# Job Claiming

A worker must safely claim a job before processing it.

Avoid two workers processing the same job simultaneously.

Use a lock/claim mechanism appropriate to the selected database.

---

# Retry

Transient failures may be retried.

Use bounded retries with backoff.

Example:

```text
Attempt 1
   ↓
Attempt 2
   ↓
Attempt 3
   ↓
Attempt 4
   ↓
Failed
```

Never retry forever.

---

# Permanent Failures

If Web Push reports a permanently invalid subscription:

```text
subscription → inactive
```

Do not retry it.

---

# Worker Stability

A single failed notification must not terminate the worker.

Errors must be isolated per job.

The worker should continue processing subsequent jobs.

---

# Graceful Shutdown

The worker should handle:

```text
SIGTERM
SIGINT
```

and:

1. Stop accepting new work.
2. Finish or safely release the current job.
3. Close database connections.
4. Exit cleanly.