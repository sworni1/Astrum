# 2026-11-28 · Role-based user model

`User` gains a stored role list and a permission layer, plus a script that reads or grants a role by email. The change is additive: existing derived checks (`isSeller`, `staffRoles`, staff guards, seller scoping) keep working, and no route changes its authorization today.

## Schema

- New enum `UserRole { CUSTOMER, SELLER, POINT_WORKER, COURIER, OWNER }`.
- `User.roles UserRole[] @default([CUSTOMER])`, so an account is a customer unless something else is granted.
- Migration `20261128120000_user_roles` creates the type and column and backfills the derived roles: a `Business` owner gets `SELLER`, a `PointWorker` row `POINT_WORKER`, a `Courier` row `COURIER`.

## Permissions

- `apps/api-astrum/src/common/helpers/permissions.ts` holds the 14-permission catalog, `ROLE_PERMISSIONS`, `permissionsOf()` (union over held roles) and `hasPermission()`. `OWNER` maps to the whole catalog, which is what “all rights” means in code.
- `GET /api/users/me` answers `roles` and the computed `permissions` beside the existing fields; `PATCH /api/users/me` and the password change inherit them through `userInfo`.
- The permission map is declarative. Resource-scoped routes (a point worker needs a `PointWorker` row, a seller needs a `Business`) still enforce their resource, so an owner without a row follows the same refusal as anyone else.

## Role sync

- `addRole(userId, role)` appends without duplicates through `updateMany` with `NOT: { roles: { has } }`.
- Granting a point role, a courier role or creating a shop now writes the matching entry into `User.roles`, so the stored list stays truthful next to the derived one.

## Script

- `pnpm db:user-role <email>` prints the stored roles and the derived flags.
- `--add <role>` appends a role and `--set <role>` replaces the list; both validate against `UserRole`. Granting `OWNER` is the only way to crown an owner today.
- `scripts/loadEnv.ts` loads `packages/Astrum-db/.env` first, because `lib/prisma.ts` resolves its fallback path for the compiled layout and missed it from source.

## Tests

- `permissions.spec.ts` proves the owner gets every permission, roles union, and the empty case.
- `user.service.spec.ts` covers `roles` and `permissions` on the profile answer; staff, seller and route suites mock the new `user.updateMany`.
- `pnpm --filter @astrum/api test` — 60 suites, 516 passed, 21 skipped. `pnpm --filter @astrum/db test`, `check-types` and `verify:build` green.

## Open

- The storefront `UserData` mirror is unchanged; no screen reads the new fields yet.
- The permission map has no route consumer beyond `/users/me`; wiring guards to permissions (and deciding how an owner picks a point) is a follow-up.
