# Dependency Rules

## Strict Dependency Policy

This project intentionally has a minimal dependency footprint.

Only the following npm packages are permitted:

```text
web-push
dotenv
```

No other external package may be installed without explicit approval.

---

# Allowed Packages

## web-push

`web-push` is responsible for:

- Web Push
- VAPID authentication
- Push encryption
- Push request generation
- Communication with browser push services

Use it through an internal service.

```text
src/push/WebPushService.js
```

Only this service should import `web-push`.

---

## dotenv

`dotenv` is responsible only for loading `.env` configuration.

Load it once during application startup.

Do not call `dotenv.config()` throughout the codebase.

---

# Node.js Core First

Before adding a dependency, determine whether Node.js already provides the required functionality.

Use:

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

when appropriate.

---

# Forbidden Dependencies

Do not add packages such as:

```text
express
fastify
koa
hapi
nestjs
axios
got
node-fetch
undici
socket.io
cors
helmet
jsonwebtoken
jose
uuid
bcrypt
pino
winston
morgan
redis
ioredis
bull
bullmq
lodash
zod
joi
yup
```

This list is not exhaustive.

The actual rule is:

> No npm package other than `web-push` and `dotenv` without explicit approval.

---

# No Manual Web Push Cryptography

Do not implement:

```text
VAPID
ECDH
HKDF
AES-GCM
Web Push encryption
```

manually.

Use `web-push`.

Node's `crypto` module may be used for unrelated application cryptography such as hashing API credentials, but it must not be used to replace the functionality provided by `web-push`.

---

# No Convenience Dependencies

Do not install a package simply because it makes a small task easier.

Examples:

```text
UUID generation
HTTP requests
routing
validation
logging
environment variables
string utilities
date utilities
```

must use Node.js core or project code.

---

# package.json

The dependency section should contain only approved packages.

Example:

```json
{
  "dependencies": {
    "dotenv": "^x.x.x",
    "web-push": "^x.x.x"
  }
}
```

Version numbers should follow the project's selected versions.

Do not add unrelated dependencies to `devDependencies` either without approval.

---

# Dependency Changes

If a requested feature cannot reasonably be implemented using:

```text
Node.js core
+
web-push
+
dotenv
```

stop and request explicit approval before introducing another package.