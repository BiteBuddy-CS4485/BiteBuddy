# BiteBuddy

Group dining decision app where friends swipe restaurants together and match on shared likes.

## Deployment Links

- API Deployment: `https://bite-buddy-api-eight.vercel.app/`
- Web Deployment: `https://bitebuddy-web.vercel.app/`
- API Docs (Swagger UI): `https://bite-buddy-api-eight.vercel.app/api/docs`

## API Docs: Check / Generate / Update

The API contract is generated and stored in two files:

- `docs/api-contract/openapi.json` (canonical docs artifact)
- `apps/api/public/openapi.json` (served by API at `/openapi.json`)

Use these commands from the repo root:

```bash
# Regenerate both OpenAPI artifacts
npm run api:contract:generate

# Validate artifacts are up to date
npm run api:contract:check
```

### When to run generate manually

- Usually not required for internal PRs because CI auto-fixes generated artifacts.
- Still required for fork-based PRs (CI cannot push to fork branches).

### CI behavior

- PRs run `api:contract:check`.
- If stale artifacts are detected, CI auto-generates and commits:
  - `docs/api-contract/openapi.json`
  - `apps/api/public/openapi.json`
- CI then re-runs the contract check.

## Local Development

- API Deployment: `localhost:3000/`
- Web Deployment: `localhost:8081/`
- API Docs (Swagger UI): `localhost:3000/api/docs`
