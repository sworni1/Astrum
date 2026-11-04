# Astrum DB

## Overview

Single source of truth for the Postgres schema and the generated Prisma client that both services import. It also holds the Excel seeding script that fills the catalogue.

## Stack

- Prisma 7 with `@prisma/adapter-pg`, `pg`, `dotenv` and `xlsx`
- The package is ESM; `main` and `exports` point at the TypeScript sources in `lib/`
- Tests: `node:test` run through `tsx`

## Key files

| File                      | Owns                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `prisma/schema.prisma`    | models, enums, and the client output folder `../generated/prisma`  |
| `lib/prisma.ts`           | `PrismaClient` singleton with the pg adapter and a `.env` fallback |
| `lib/index.ts`            | public entry, re-exports the client and `prisma`                   |
| `prisma/seedFromExcel.ts` | bulk product seeding from the Russian named xlsx folder            |

## Commands

```bash
pnpm --filter @astrum/db db:generate
pnpm --filter @astrum/db check-types
pnpm --filter @astrum/db test
pnpm --filter @astrum/db seed:excel
```

## Conventions

- Never edit `generated/prisma`; change `prisma/schema.prisma` and run generate again.
- Consumers import from `@astrum/db` only, never by relative path into this package.
- Migrations are created from the repo root with `pnpm prisma:migrate:dev`.

## Gotchas

- `generated/prisma` is not committed; a fresh checkout needs `pnpm db:generate` before any type check or build.
- Each package generates its own copy of the client: `apps/api-astrum/generated/prisma` used to be a symlink into this package, which let a generate from either side overwrite the other's client from a schema that had drifted. Keep `apps/api-astrum/prisma/schema.prisma` byte identical to this one (copy it over after an edit); if the two ever differ, the app and its tests fight over relation field names.
- `seed:excel` runs with `--max-old-space-size=8192` and reads every xlsx file inside `Бесплатная база товаров 2018`.
- Build scripts are allowlisted in `pnpm-workspace.yaml` under `allowBuilds` (pnpm 12 ignores `pnpm.onlyBuiltDependencies`); a new native dependency needs an entry there or its install script is skipped.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
