# Scope: Astrum monorepo

A shop with a Next.js storefront, an Express gateway, a NestJS auth service, and a shared Prisma package. Each workspace keeps its own scope file; this page only maps them.

**Build approach:** Tracer Bullet (every feature works end to end through the storefront and the gateway).
**Workflow:** Beta (after `/develop`: `/check verify`, then `/test`).

## Workspaces

| Workspace                                                          | Scope                                        | Rollup                              |
| ------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------- |
| `_root` (order flow, sessions, account confirmation, English copy) | [_root/scope.md](_root/scope.md)             | 5 done / 4 in progress / 4 planned  |
| `apps/customer`                                                    | [customer/scope.md](customer/scope.md)       | 1 done / 0 in progress / 10 planned |
| `apps/api-astrum`                                                  | no scope yet                                 | 0 / 0                               |
| `apps/auth-astrum`                                                 | [auth-astrum/scope.md](auth-astrum/scope.md) | 1 done / 0 planned                  |
| `apps/worker`                                                      | no scope yet                                 | 0 / 0                               |
| `packages/astrum-db`                                               | no scope yet                                 | 0 / 0                               |

Repo wide decisions that no single app owns live in `docs/adr/`. Work that crosses workspaces is planned in `docs/scope/_root/`; the order flow and the account confirmation flow live there.
