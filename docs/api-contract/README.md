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
3. Run `npm run api:contract:generate`.
4. Commit route changes and both generated JSON files.

`api:contract:check` fails if:
- A route exists without a matching contract definition.
- A contract definition no longer maps to a real route.
- `docs/api-contract/openapi.json` is outdated.

## CI Behavior

- PRs run `api:contract:check` and fail when the contract is out of sync.
- Pushes to `main` run an auto-update workflow that regenerates and commits:
  - `docs/api-contract/openapi.json`
  - `apps/api/public/openapi.json`
