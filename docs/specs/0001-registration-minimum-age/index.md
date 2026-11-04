---

id: 0001
slug: registration-minimum-age
status: In Progress
adrs: []
---

# Minimum age gate on registration

## Problem

`POST /api/auth/register` accepts any `dateOfBirth` that is a date string. `RegisterUserDto` only has `@IsDateString()`, so the API stores a user of any age. The storefront checks 14 years in the browser (`registerFormSchema`), but that is a convenience for the form, not a rule: any other client, a replay of an old bundle, or a direct call registers a child without complaint.

## Decision

Validate in the DTO with a custom class-validator decorator `@MinAge(14)` in `apps/auth-astrum/src/auth/dto/min-age.validator.ts`, next to the existing `@IsDateString()`. The global `ValidationPipe` in `src/main.ts` already owns the request contract and already returns 400 with the decorator message, so no controller or service code changes.

Rejected: a Postgres `CHECK` constraint (`CHECK (date_of_birth <= now() - interval '14 years')`). Postgres refuses `now()` in a `CHECK` because the expression is not `IMMUTABLE`, and a trigger adds write path machinery for a single write path that already has one gate.

Rejected: a check inside `AuthService.register`. It is further from the contract, it does not show up in Swagger, and any future endpoint that accepts a birthday would have to copy it.

## Acceptance criteria

1. `POST /api/auth/register` with `dateOfBirth` younger than 14 complete years returns 400 with the message `You must be at least 14 years old`, and no user row is created.
2. A birthday exactly 14 years ago today returns 200 and the user is created.
3. A birthday in the future returns 400 with the message `Date of birth cannot be in the future`.
4. A missing, empty or non date `dateOfBirth` keeps returning 400 through the existing `@IsDateString()`, with no new message.
5. The rule reads one constant, and the same number is documented in Swagger on the `dateOfBirth` property.

## Values

| Value shown or computed | Source                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| age in complete years   | `dateOfBirth` from the request body, compared with the server clock at request time (`new Date()`) |
| `14`                    | `MIN_AGE_YEARS` exported from `min-age.validator.ts`                                               |
| 400 body message        | the `message` given to `@MinAge()` in `RegisterUserDto`                                            |
| HTTP status 400         | the global `ValidationPipe` in `apps/auth-astrum/src/main.ts`                                      |
| user not created        | the pipe rejects before the controller method runs                                                 |

## Out of scope

- A database level guarantee for writes that bypass the API.
- Mapping the 400 to a field error in the storefront form (its own planned row under `apps/customer`).
- Re-checking the age of users who already have rows.

## Assumptions

- `Assumed:` a 29 February birthday is treated as its birthday on 1 March in non leap years (UTC), because the comparison normalises to the same month and day. Not ratified.
- `Assumed:` the rule counts years in UTC. The service has no timezone data, and a one day edge for users near the date line is accepted.

## Build plan

1. `min-age.validator.ts` with `MIN_AGE_YEARS`, `registerDecorator`, and the two messages. Unit test first with a boundary table: 14 years minus one day false, exactly 14 years true, 14 years plus one day true, future false, leap day case.
2. `RegisterUserDto.dateOfBirth`: add `@MinAge(MIN_AGE_YEARS)` beside `@IsDateString()`, extend the `ApiProperty` description with the rule.
3. `apps/auth-astrum/test/api-astrum.e2e-spec.ts`: three new cases, a 13 year old gets 400 and leaves no row, exactly 14 years gets 200, a future birthday gets 400.

## Verification

| AC  | How to prove it                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm --filter @astrum/auth test:e2e -t "younger than"`, then a `curl` against the running service, 400 |
| 2   | `pnpm --filter @astrum/auth test:e2e -t "exactly"`                                                      |
| 3   | `pnpm --filter @astrum/auth test:e2e -t "future"`                                                       |
| 4   | `pnpm --filter @astrum/auth test:e2e -t "missing"`                                                      |
| 5   | `pnpm --filter @astrum/auth test`, then `/swagger` on the running service                               |
| all | `pnpm --filter @astrum/auth check-types && pnpm --filter @astrum/auth lint`                             |
