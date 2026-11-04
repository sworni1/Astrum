# Scope: Astrum auth service

Registration, sign in and token refresh for every client of the shop. It signs the JWT that the gateway verifies and owns the user row that the storefront reads.

**Build approach:** Tracer Bullet (a slice works end to end before the next one starts).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`).

_These are recommendations to keep the build orderly, not requirements. Skip anything that does not fit. You decide when a feature is `done`._

## At a glance

| #   | Feature                          | Phase    | Status      |
| --- | -------------------------------- | -------- | ----------- |
| A   | Register, sign in, token refresh | Existing | existing    |
| 1   | Minimum age gate on register     | Slice 1  | done        |

## Already built

### A. Register, sign in, token refresh · existing

`POST /api/auth/register`, `POST /api/auth/signin`, argon2 password hashing, JWT with a one day expiry, DTO validation through the global `ValidationPipe`. code in `apps/auth-astrum/src/auth/`

## Slice 1: Registration guard rails

### 1. Minimum age gate on register · done

The API stores whatever birthday it is given, so a client that skips the browser check registers a child. The rule has to sit where every registration passes.
**Done when:** registering with a birthday younger than 14 returns 400 with a clear message and creates no user, a birthday exactly 14 years old is accepted, and a future birthday is refused.
- [x] Design it (spec): `/architect minimum age gate on register`
- [x] Build it: `/develop minimum age gate on register`
  - [x] Validator and its boundary unit tests (AC 1, 2, 3)
  - [x] DTO wiring and the Swagger note (AC 5)
  - [x] e2e register cases (AC 1, 2, 3, 4)
- [x] Verify it: `/check verify minimum age gate on register`
- [x] Test it: `/test minimum age gate on register`
  Spec 0001 ([index.md](../../specs/0001-registration-minimum-age/index.md)) · code in `apps/auth-astrum/src/auth/dto/`

## Legend

- **Next step** = the first unticked box.
- **Status**: `planned` → `in-progress` → `done`, plus `existing` (built before this scope) and `dropped`.
- A row tagged `needs a decision` runs `/architect` first; the tag drops once its spec is captured.
- **Workflow tag** beside a heading (for example `· GA`) overrides the project default for that feature.
