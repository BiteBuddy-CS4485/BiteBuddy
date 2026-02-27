# API Contract

This project uses an OpenAPI 3.0 contract generated from source-controlled definitions.

## Files

- `scripts/openapi/contract-definitions.cjs`: endpoint metadata + component schemas.
- `scripts/generate-openapi.cjs`: generator that validates route coverage and writes OpenAPI JSON.
- `docs/api-contract/openapi.json`: canonical generated artifact for reviews and tooling.
- `apps/api/public/openapi.json`: deployable copy served by Next.js.
- `apps/api/src/app/api/docs/route.ts`: hosted Swagger UI at `/api/docs`.

## Commands

```bash
npm run api:contract:generate
npm run api:contract:check
```

## Workflow

1. Add or change a route handler in `apps/api/src/app/api/**/route.ts`.
2. Update `scripts/openapi/contract-definitions.cjs` with the endpoint contract.
3. Open a PR. CI will auto-fix generated OpenAPI artifacts when needed.

`api:contract:check` fails if:
- A route exists without a matching contract definition.
- A contract definition no longer maps to a real route.
- `docs/api-contract/openapi.json` is outdated.

## CI Behavior

- PRs run `api:contract:check`.
- If artifacts are stale, CI runs `api:contract:generate`, commits the generated files to the PR branch, and re-runs the check.
- Fork PRs cannot be auto-pushed by CI, so those contributors must generate and commit artifacts manually.
