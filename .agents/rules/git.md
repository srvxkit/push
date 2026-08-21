# Git Flow Rules

## Branch Structure

This project follows a Git Flow-based branching strategy.

- `main` — Production-ready and stable code.
- `develop` — Main development and integration branch.
- `feature/*` — New features and improvements.
- `release/*` — Release preparation.
- `hotfix/*` — Urgent production fixes.

---

## Main Branch Rules

### `main`

- Never commit directly to `main`.
- `main` must always contain production-ready code.
- Changes must come through a Pull Request.
- Releases and hotfixes are merged into `main`.
- Every production release should have a Git tag.
- Do not force-push to `main`.

---

## Develop Branch Rules

### `develop`

- `develop` is the primary development branch.
- New features must start from `develop`.
- Completed features are merged back into `develop`.
- Do not commit unrelated changes directly to `develop`.
- Keep `develop` buildable and testable.

---

## Feature Branches

### Naming

Feature branches must use:

```text
feature/<short-description>
```

Examples:

```text
feature/user-authentication
feature/notification-system
feature/profile-page
feature/api-rate-limit
```

### Creating a Feature Branch

Always create feature branches from the latest `develop`:

```bash
git switch develop
git pull origin develop
git switch -c feature/<short-description>
```

### Feature Rules

- Do not create feature branches from `main`.
- Keep a feature branch focused on one feature or related change.
- Do not mix unrelated fixes into a feature branch.
- Push the branch to the remote repository.
- Merge features into `develop` through a Pull Request.

Flow:

```text
feature/user-authentication
        ↓
     develop
```

---

## Release Branches

### Naming

Release branches must use:

```text
release/<version>
```

Examples:

```text
release/1.0.0
release/1.2.0
release/2.0.0
```

### Creating a Release

Create the release branch from `develop`:

```bash
git switch develop
git pull origin develop
git switch -c release/1.0.0
```

### Release Rules

- Only release preparation should be performed on a release branch.
- Do not add new features during release preparation.
- Bug fixes and release-related changes are allowed.
- Update version information where required.
- Run the complete test/build process before merging.
- Merge the release branch into both `main` and `develop`.

Flow:

```text
develop
   ↓
release/1.0.0
   ↓
  ┌───────┐
  ↓       ↓
main   develop
```

---

## Hotfix Branches

### Naming

Hotfix branches must use:

```text
hotfix/<version>
```

Examples:

```text
hotfix/1.0.1
hotfix/1.2.1
```

### Creating a Hotfix

Hotfix branches must be created from `main`:

```bash
git switch main
git pull origin main
git switch -c hotfix/1.0.1
```

### Hotfix Rules

- Use hotfix branches only for urgent production issues.
- Keep the change as small and focused as possible.
- Do not add unrelated features.
- Merge the hotfix into `main`.
- Also merge the hotfix into `develop` so the fix is not lost.
- Tag the production release after merging into `main`.

Flow:

```text
        main
         ↓
  hotfix/1.0.1
       ↓   ↓
      main develop
```

---

## Pull Request Rules

Pull Requests should:

- Have a clear title.
- Explain what changed.
- Explain why the change was needed.
- Include relevant tests.
- Include screenshots for UI changes when appropriate.
- Be reviewed before merging when review is available.
- Avoid unrelated changes.

### Pull Request Targets

```text
feature/*  → develop
release/*  → main
release/*  → develop
hotfix/*   → main
hotfix/*   → develop
```

Do not use:

```text
feature/* → main
```

unless there is an explicit project-level exception.

---

## Commit Rules

Write clear, meaningful commit messages.

Preferred format:

```text
<type>: <description>
```

Examples:

```text
feat: add user authentication
fix: resolve notification delivery error
refactor: simplify token validation
docs: update installation guide
test: add authentication tests
chore: update dependencies
build: update production build configuration
```

### Commit Guidelines

- Keep commits focused.
- Do not commit generated files unless the project requires them.
- Do not commit secrets, credentials, API keys, or `.env` files.
- Do not create meaningless commits such as `update`, `changes`, or `fix stuff`.

---

## Sync Before Starting Work

Before creating a new feature or starting development, synchronize `develop`:

```bash
git switch develop
git pull origin develop
```

Then create the feature branch:

```bash
git switch -c feature/<short-description>
```

---

## Keeping Feature Branches Updated

If `develop` has moved forward while working on a feature, update the feature branch before opening or updating a Pull Request.

Preferred approach:

```bash
git fetch origin
git rebase origin/develop
```

Resolve conflicts carefully and run the project's tests afterward.

Do not force-push shared branches.

If a feature branch has already been pushed and rebasing is necessary, use:

```bash
git push --force-with-lease
```

Never use:

```bash
git push --force
```

---

## Merge Rules

Use Pull Requests for normal branch integration.

Do not merge:

```text
feature → main
```

Normal development flow:

```text
feature/*
    ↓
 develop
    ↓
release/*
    ↓
 main
```

Production emergency flow:

```text
hotfix/*
    ↓
 main
    ↓
 develop
```

---

## Version Tags

Production releases should use semantic versioning:

```text
vMAJOR.MINOR.PATCH
```

Examples:

```text
v1.0.0
v1.1.0
v1.1.1
v2.0.0
```

Create a release tag on `main`:

```bash
git switch main
git pull origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

---

## Protected Branches

The following branches should be protected on GitHub:

```text
main
develop
```

Recommended protection:

- Require Pull Requests.
- Prevent direct pushes.
- Prevent force pushes.
- Require successful CI checks before merging.
- Require review when appropriate.

---

## Forbidden Actions

Agents and developers must not:

- Commit directly to `main`.
- Create feature branches from `main`.
- Merge feature branches directly into `main`.
- Force-push `main` or `develop`.
- Delete `main` or `develop`.
- Commit secrets or credentials.
- Commit `.env` files containing secrets.
- Rewrite shared branch history.
- Mix unrelated changes into a Pull Request.
- Skip tests/build validation before merging release or hotfix branches.

---

## Standard Development Workflow

```bash
# Update development branch
git switch develop
git pull origin develop

# Create feature branch
git switch -c feature/<short-description>

# Work and commit
git add .
git commit -m "feat: <description>"

# Push feature
git push -u origin feature/<short-description>

# Create PR:
# feature/<short-description> → develop
```

After enough features are completed:

```bash
git switch develop
git pull origin develop
git switch -c release/1.0.0
```

After release validation:

```text
release/1.0.0 → main
release/1.0.0 → develop
```

Then tag `main`:

```bash
git switch main
git pull origin main
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

---

## Agent Behavior

When modifying this project:

1. Check the current Git branch before making changes.
2. Never make changes directly on `main`.
3. Use an appropriate `feature/*`, `release/*`, or `hotfix/*` branch.
4. Do not switch branches if doing so could destroy or overwrite uncommitted user work.
5. Never reset, clean, or discard user changes without explicit permission.
6. Keep commits focused and meaningful.
7. Follow the branch naming conventions defined in this document.
8. Do not push to `main` or `develop` unless explicitly authorized.
9. Never force-push shared branches.
10. Before recommending a merge, ensure tests and required checks pass.
11. Preserve the existing Git history.
12. Do not rewrite history unless explicitly requested.

## Source of Truth

This file defines the project's Git workflow.

When other instructions conflict with these Git rules, follow the more specific project-level instruction if explicitly provided by the project owner.
