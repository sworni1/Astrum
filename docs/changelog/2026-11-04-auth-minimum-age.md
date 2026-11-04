# 2026-11-04 · Minimum age on registration

Spec: [0001-registration-minimum-age](../specs/0001-registration-minimum-age/index.md).

## Changed

- `apps/auth-astrum/test/jest-e2e.json` — the suite now loads `test/setup-env.ts` and
  `reflect-metadata` before any test module. The gateway builds its proxy at import time, so
  an env value set inside `beforeAll` came too late and the suite died on a missing target.
- `apps/auth-astrum/package.json` — `test:e2e` runs jest through
  `node --experimental-vm-modules`, so jest can `require` the ESM only
  `http-proxy-middleware` 4 that `apps/api-astrum/src/app.ts` imports.
- `apps/auth-astrum/test/api-astrum.e2e-spec.ts` — the test app now mounts the same
  `/api` global prefix as `src/main.ts` (without it every auth call answered `404`), and both
  Prisma pools are disconnected in `afterAll`, so the worker exits instead of being force
  killed.
- `apps/auth-astrum/test/app.e2e-spec.ts` — the scaffold case waited for `Hello World!` on
  `/`, a route that never existed. It now proves `GET /health` answers `200` while the
  database is reachable.
- `apps/auth-astrum/.prettierrc` removed. It asked for single quotes while every file in the
  package and the root config use double quotes, so `pnpm lint` (which is `eslint --fix`)
  rewrote all 19 source files on each run. Prettier now resolves the root config.

## Added

- `apps/auth-astrum/test/setup-env.ts` — loads `apps/api-astrum/.env` and
  `apps/auth-astrum/.env` for the e2e suite, with a fallback secret and auth URL.

## Verified

- `pnpm --filter @astrum/auth test` → 14 passed.
- `pnpm --filter @astrum/auth test:e2e` → 6 passed, two suites, no open handle warning.
- `pnpm --filter @astrum/auth check-types` → clean. `pnpm --filter @astrum/auth lint` → clean
  and leaves the tree untouched.
- Against the running service on `:4580`: a 13 year old answers `400 You must be at least 14
  years old` and the following sign in answers `403`, exactly 14 years answers `200` with a
  token, tomorrow answers `400 Date of birth cannot be in the future`, `not-a-date` answers
  `400` with only the date message, an omitted date answers `400` from the date validators
  only. `/swagger-json` carries `Date of birth, at least 14 years ago`.

## Open

- `Assumed:` a 29 February birthday counts on 1 March in a non leap year, and the age is
  counted in UTC. Both stay unratified in spec 0001.
- The storefront form still maps a `400` to a field error through its own planned row under
  `apps/customer`.
