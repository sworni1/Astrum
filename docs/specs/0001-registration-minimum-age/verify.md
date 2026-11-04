# Verify: Minimum age gate on register · spec 0001 · updated 2026-11-04

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [x] Open `/swagger` on the running auth service and read `RegisterUserDto.dateOfBirth` → description says "Date of birth, at least 14 years ago" → AC 5

## Commands

Run against the auth service (`http://localhost:4580`), body `{"email": ..., "password": "qwertyuiop", "gender": "Male", "dateOfBirth": ...}`.

- [x] `dateOfBirth` = today minus 13 years → `400`, message contains `You must be at least 14 years old` → AC 1
- [x] sign in with the same email → `403 The user does not exist` (the row was never created) → AC 1
- [x] `dateOfBirth` = today minus 14 years → `200` and a token comes back → AC 2
- [x] `dateOfBirth` = tomorrow → `400`, message contains `Date of birth cannot be in the future` → AC 3
- [x] `dateOfBirth` = `not-a-date` → `400`, message is exactly `["dateOfBirth must be a valid ISO 8601 date string"]`, no age message → AC 4
- [x] `dateOfBirth` omitted → `400` from the date validators, no age message → AC 4
- [x] `pnpm --filter @astrum/auth check-types` → clean → all
- [x] `pnpm --filter @astrum/auth test:e2e` → 6 tests pass, needs `pnpm db:up` first → AC 1, 2, 3, 4

## Acceptance-criteria coverage

- AC 1 … the 13 year and the sign in steps
- AC 2 … the exactly 14 years step, plus the boundary unit test `принимает день рождения ровно в 14 лет`
- AC 3 … the future date step
- AC 4 … the invalid and the omitted date steps
- AC 5 … the Swagger step
- Values · age is counted in UTC from `dateOfBirth` against the server clock: the "minus 14 years minus one day" boundary case is locked as a unit case
- Environment · the e2e suite runs through `node --experimental-vm-modules`, because `http-proxy-middleware` 4 is ESM only and the suite imports the gateway app. `test/setup-env.ts` loads `apps/api-astrum/.env` and `apps/auth-astrum/.env` before any module is imported, because the gateway builds its proxy at import time.
