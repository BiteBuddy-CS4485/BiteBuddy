# Selenium E2E Tests

This package contains Selenium end-to-end tests for BiteBuddy web flows.

## Test Suites

- `auth-smoke.test.mjs`: unauthenticated auth-form smoke checks
- `navigation-smoke.test.mjs`: cross-screen navigation smoke checks
- `authenticated-smoke.test.mjs`: seeded-account authenticated flow checks

## Prerequisites

```bash
npm install
```

- Install at least one browser locally: Chrome, Edge, or Firefox.
- For authenticated tests, configure Supabase service role access.

## Start Web App

From repo root:

```bash
$env:CI=1; npm -w @bitebuddy/mobile run web -- --port 19006
```

## Run Unauthenticated Smoke Tests

From repo root:

```bash
$env:BASE_URL='http://127.0.0.1:19006'; npm run e2e:selenium
```

Headed mode:

```bash
$env:BASE_URL='http://127.0.0.1:19006'; npm run e2e:selenium:headed
```

## Run Seeded Authenticated Tests

1. Ensure service-role env vars are available (recommended in `apps/api/.env.local`):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

2. Seed users + relational data:

```bash
npm run e2e:seed
```

3. Run authenticated Selenium tests:

```bash
$env:BASE_URL='http://127.0.0.1:19006'; npm run e2e:selenium:auth
```

Headed authenticated mode:

```bash
$env:BASE_URL='http://127.0.0.1:19006'; npm run e2e:selenium:auth:headed
```

## Seeded Test Accounts

Defaults (overridable via env):

- Host: `e2e.host@bitebuddy.test`
- Friend: `e2e.friend@bitebuddy.test`
- Needs setup: `e2e.needs-setup@bitebuddy.test`
- Password: `BiteBuddy123!`

Optional overrides:

- `E2E_PASSWORD`
- `E2E_HOST_EMAIL`, `E2E_HOST_PASSWORD`
- `E2E_FRIEND_EMAIL`, `E2E_FRIEND_PASSWORD`
- `E2E_NEEDS_SETUP_EMAIL`, `E2E_NEEDS_SETUP_PASSWORD`

## Selenium Environment Variables

- `BASE_URL`: default `http://127.0.0.1:19006`
- `SELENIUM_BROWSER`: `chrome` (default), `edge`, `firefox`
- `SELENIUM_HEADLESS`: `true` (default) or `false`
- `SELENIUM_TIMEOUT_MS`: default `15000` for smoke, `20000` for auth suite
