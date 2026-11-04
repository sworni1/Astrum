# Verify: Minimum age gate on register · spec 0001 · updated 2026-11-04

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Open `/swagger` on the running auth service and read `RegisterUserDto.dateOfBirth` → description says "Date of birth, at least 14 years ago" → AC 5

## Commands

Run against the auth service (`http://localhost:4580`), body `{"email": ..., "password": "qwertyuiop", "gender": "Male", "dateOfBirth": ...}`.

- [ ] `dateOfBirth` = today minus 13 years → `400`, message contains `You must be at least 14 years old` → AC 1
- [ ] sign in with the same email → `403 The user does not exist` (the row was never created) → AC 1
- [ ] `dateOfBirth` = today minus 14 years → `200` and a token comes back → AC 2
- [ ] `dateOfBirth` = tomorrow → `400`, message contains `Date of birth cannot be in the future` → AC 3
- [ ] `dateOfBirth` = `not-a-date` → `400`, message is exactly `["dateOfBirth must be a valid ISO 8601 date string"]`, no age message → AC 4
- [ ] `dateOfBirth` omitted → `400` from the date validators, no age message → AC 4
- [ ] `pnpm --filter @astrum/auth check-types` → clean → all
- [ ] `npx jest` inside `apps/auth-astrum` → 14 tests pass → AC 1, 2, 3, 4

## Acceptance-criteria coverage

- AC 1 … the 13 year and the sign in steps
- AC 2 … the exactly 14 years step, plus the boundary unit test `принимает день рождения ровно в 14 лет`
- AC 3 … the future date step
- AC 4 … the invalid and the omitted date steps
- AC 5 … the Swagger step
- Values · age is counted in UTC from `dateOfBirth` against the server clock: the "minus 14 years minus one day" boundary case belongs to `/test` as a locked unit case
- Not automatable here · the e2e suite (`test/api-astrum.e2e-spec.ts`) cannot run in this environment, because jest cannot require the ESM Prisma client from `packages/astrum-db` and the scaffold `test/app.e2e-spec.ts` expects a Hello World route that does not exist
