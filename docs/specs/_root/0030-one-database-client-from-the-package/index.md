# 0030. One database client from the package

**Date**: 2026-11-19
**Status**: In Progress

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The repository keeps one Prisma schema in four byte identical copies, one per app, and every app imports its own generated client: 90 imports in 68 files. The copies have to be kept in step by hand, so a drift arrives as a failing suite instead of an honest error, and the shared package that already holds the schema and the migrations is imported by nobody. This spec makes `@astrum/db` the only place that reads the schema and generates the client, builds that client into JavaScript with type declarations, and has every service import it. The images then carry the built package instead of generating their own copy.

## Requirements

**User stories**:

- As a developer changing the schema, I want to edit one file and see every service pick it up, so that I never chase a copy that drifted.
- As a developer reading a service, I want one obvious import path for the database client, so that I do not have to learn four folders.
- As the person who deploys, I want the image to contain the same client the tests ran against, so that a green build cannot ship a different client.

**Acceptance criteria** (the contract):

- **AC-1**: `packages/Astrum-db/prisma/schema.prisma` is the only schema in the repository. `find . -name 'schema.prisma' -not -path './node_modules/*' -not -path '*/generated/*'` prints exactly that one path; the three `apps/<app>/prisma/` folders (each holds only `schema.prisma` today) and the three `apps/<app>/prisma.config.ts` files, which sit at the app roots, are deleted, so `find . -name 'prisma.config.ts' -not -path './node_modules/*'` prints one path. The generator block keeps `provider = "prisma-client"` and `output = "../generated/prisma"` and gains exactly two lines, `moduleFormat = "cjs"` and `importFileExtension = "js"`; models and enums are untouched, so the file differs from today's in those two lines. The second line is not decoration: reproduced on 7.10.1, `moduleFormat = "cjs"` alone makes the generator emit `import * as $Enums from "./enums.ts"`, which `tsc` refuses with TS5097, while adding `importFileExtension = "js"` produces `./enums.js` and no `.ts` specifier anywhere. `prisma` leaves the three apps' `devDependencies`, and their `prisma:generate` scripts leave with it.

- **AC-2**: The package builds itself. `packages/Astrum-db/package.json` loses `"type": "module"` and loses `main` and `types` (the bare entry is closed on purpose, so nothing may resolve through them), and `exports` holds exactly two entries, each carrying `types` and `default`: `./client` and `./enums`, both pointing at `dist/generated/prisma/<name>.js` with the `.d.ts` beside it. There is no `"."` entry, so a bare `require('@astrum/db')` answers `ERR_PACKAGE_PATH_NOT_EXPORTED` while `@astrum/db/client` resolves. `lib/index.ts` stays as an internal module, because `packages/Astrum-db/scripts/assignBusiness.ts:3` imports it by relative path. `scripts.build` runs `prisma generate`, writes the md5 of the schema into `dist/.schema-hash`, then runs `tsc -p tsconfig.build.json`, which emits CommonJS from `lib/**/*.ts` and `generated/**/*.ts` with `rootDir` at the package root, `outDir` `dist`, `declaration` on, `module` and `moduleResolution` `node16`. After `pnpm --filter @astrum/db build`, `dist/lib/index.js`, `dist/lib/prisma.js`, `dist/generated/prisma/client.js`, `dist/generated/prisma/enums.js` and the `.d.ts` for each exist, and `git status` shows nothing inside `dist` (it stays ignored). `scripts.check-types` runs `prisma generate` first and then `tsc -p tsconfig.check.json --noEmit`, and that tsconfig covers `lib`, `generated`, `prisma`, `scripts` and `src`, because a fresh clone holds neither `generated` nor `dist` and today's type check covers all five folders. `lib/prisma.ts` drops `import.meta.url` (CommonJS has none) and resolves the optional `.env` fallback from `__dirname` to `../../.env`. The three files that cannot be CommonJS keep working through nested manifests: `packages/Astrum-db/prisma/package.json` and `packages/Astrum-db/scripts/package.json` each hold `{"type": "module"}`, so `import.meta.dirname` in `prisma/seedFromExcel.ts:256` and the top level `await main()` in `scripts/assignBusiness.ts:97` and `scripts/pickupPoint.ts:128` still run under `tsx`, and `pnpm --filter @astrum/db seed:excel` still boots.

- **AC-3**: The client cannot silently go stale or half installed. `scripts["verify:build"]` is a node script that fails when any of four things holds: `devDependencies.prisma` and `dependencies["@prisma/client"]` are not equal (both fields are named because they live in different blocks, and reading a missing key as `undefined` would pass), a target of the `exports` map is absent on disk (`dist/generated/prisma/client.js` with `client.d.ts` beside it, and the same pair for `enums`), `dist/.schema-hash` differs from the md5 of `packages/Astrum-db/prisma/schema.prisma`, or `dist` is missing altogether. The hash is what catches the drift this feature exists to stop: a rebuilt schema with an old `dist` passes every other check. `quality-gate` in the package runs it. Measured proof for the type failure it guards: with `dist` deleted, `pnpm --filter @astrum/auth check-types` fails on a missing module rather than passing with `any`.

- **AC-4**: Every service declares the edge that makes the package part of its build, and the pipeline stops running generate twice. `apps/api-astrum`, `apps/auth-astrum` and `apps/worker` carry `"@astrum/db": "workspace:*"` in `dependencies` and not in `devDependencies`, because the runner stage installs with `--prod` and reaches the copied `dist` through that workspace symlink. `pnpm turbo prune @astrum/api --docker --out-dir <dir>` leaves `packages/Astrum-db/package.json` and `packages/Astrum-db/prisma/schema.prisma` inside `<dir>/full`, which is what lets the image build the client. In `turbo.json`, `build` and `dev` drop `^db:generate` and take `^build`, and `check-types` takes `["^build", "^check-types"]`. Dropping it is a fix, not tidying: the package build runs `prisma generate` itself, so any app task that also waited on `^db:generate` starts a second generate writing the same folder, and two runs on one folder corrupt it. The root `prisma:generate` script is deleted (the four clients it promised no longer exist) and `pnpm db:generate` stays as the manual way to regenerate the package alone.

- **AC-5**: Imports come from the package and nowhere else. `grep -rn "generated/prisma" apps --include=*.ts --include=*.tsx` prints nothing (measured 2026-11-19: 68 files, 55 in `api-astrum`, 5 in `auth-astrum`, 3 in `worker`, 5 inside the package, holding 90 import specifiers: 65 `client`, 24 `enums`, one `internal/prismaNamespace`). Each becomes `@astrum/db/client` or `@astrum/db/enums`, and a specifier that was type only stays a type only import (`import type`). `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts:5` stops importing the generated `internal/prismaNamespace` and takes `Prisma.PrismaClientKnownRequestError` from `@astrum/db/client`, because `client.ts` exports the `Prisma` namespace and `internal/*` is not a stable surface. Inside `packages/Astrum-db`, `lib/*.ts`, `prisma/seedFromExcel.ts` and `scripts/*.ts` keep relative paths into `generated/prisma`, because they compile together; nothing outside the package may.

- **AC-6**: Each service still builds its own client instance with its own pool. `apps/api-astrum/lib/prisma.ts` and `apps/worker/lib/prisma.ts` keep calling `new PrismaClient({ adapter })`, and `apps/auth-astrum/src/prisma/prisma.service.ts:8` keeps `class PrismaService extends PrismaClient` with `super({ adapter })` and its module level `DB_POOL_SIZE` read; only the `PrismaClient` import line changes in all three. The package singleton in `lib/prisma.ts` stays for the seed script, which imports it by relative path (`prisma/seedFromExcel.ts:11`), and it is not published as a subpath, so `grep -rn "@astrum/db/prisma" apps packages --include=*.ts` prints nothing.

- **AC-7**: The three images carry the built package. In `apps/api-astrum/Dockerfile`, `apps/auth-astrum/Dockerfile` and `apps/worker/Dockerfile` the builder stage runs `pnpm --filter @astrum/db build` before the app build and no longer runs `prisma generate`, and the runner stage copies `/app/packages/Astrum-db/dist`; the worker no longer copies `generated`. `pnpm docker:prod:build` exits 0, `pnpm docker:prod:up` brings the stack up, and `GET /health` answers `200` on api, auth and worker. Inside the running api container `node -e "require.resolve('@astrum/db/client')"` exits 0, which proves the client is on the image and not only in the builder. The one shot `migrate` service and its Dockerfile stay as they are.

- **AC-8**: Nothing that passed before fails after. `pnpm quality-gate` from the root exits 0: the package suite, api jest (489 cases at the last full run), auth jest, worker `node:test`, and the storefront untouched. The worker suite, which runs through `tsx --test`, resolves `@astrum/db/client` from the built `dist`, so an unbuilt package fails `pnpm test` loudly instead of silently using an old client.

## Decision

**Chosen option**: Option 2: the package compiles itself and the apps import it.

`@astrum/db` is the only owner of the schema, the migrations and the generated client; it builds that client into CommonJS with type declarations, and the three services take it through `@astrum/db/client` and `@astrum/db/enums`, each keeping its own `PrismaClient` instance and its own pool.

**Implementation skills**: none installed for this stack.

## The change

**Surface of the package after the change**:

| Entry | Resolves to | Used by |
|---|---|---|
| `@astrum/db/client` | `dist/generated/prisma/client.js` | api, auth, worker (the client class, the model types and the `Prisma` namespace) |
| `@astrum/db/enums` | `dist/generated/prisma/enums.js` | the services that compare enum values |

Two entries only, on purpose: `./browser` would have no consumer in this tree, and `./prisma` is unnecessary because the seed script reaches the singleton by relative path.

**Where each service stands**:

| Workspace | Today | After |
|---|---|---|
| `packages/Astrum-db` | source of truth, plus a client nobody imports | the only schema, the only `prisma generate`, the only built client `dist` |
| `apps/api-astrum` | own schema copy and own client, 55 files importing it | `workspace:*` edge, imports from `@astrum/db`, image copies `dist` |
| `apps/auth-astrum` | same, 5 files | same |
| `apps/worker` | same, 3 files, image also copies `generated` | same, image copies `dist` only |
| `apps/customer` | hand written enum mirrors (spec 0029) | unchanged |

**Exact artifacts** (so the build settles no shape twice):

`packages/Astrum-db/package.json` after the change, the parts that matter:

```json
{
  "exports": {
    "./client": { "types": "./dist/generated/prisma/client.d.ts", "default": "./dist/generated/prisma/client.js" },
    "./enums": { "types": "./dist/generated/prisma/enums.d.ts", "default": "./dist/generated/prisma/enums.js" }
  },
  "scripts": {
    "db:generate": "prisma generate",
    "build": "prisma generate && node scripts/writeSchemaHash.mjs && tsc -p tsconfig.build.json",
    "check-types": "prisma generate && tsc -p tsconfig.check.json --noEmit",
    "verify:build": "node scripts/verifyBuild.mjs",
    "quality-gate": "pnpm check-types && pnpm test && pnpm verify:build"
  }
}
```

No `"type"` field, so Node reads the emitted files as CommonJS, and no `main` or `types`, because nothing may resolve through the bare entry. `scripts/verifyBuild.mjs` compares `devDependencies.prisma` with `dependencies["@prisma/client"]`, requires `dist/generated/prisma/client.js` and `client.d.ts` plus the same pair for `enums`, and compares `dist/.schema-hash` with the md5 of `prisma/schema.prisma`; it prints the two versions and both hashes before it exits. `scripts/writeSchemaHash.mjs` writes that hash during the build.

`packages/Astrum-db/tsconfig.build.json` for the emit, and `packages/Astrum-db/tsconfig.check.json` which extends it with `"noEmit": true` and `"include": ["lib/**/*.ts", "generated/**/*.ts", "prisma/**/*.ts", "scripts/**/*.ts", "src/**/*.ts"]`, so the type check covers the seed, the three scripts and the one test. `tsconfig.json` stays only as the editor entry:

```json
{
  "compilerOptions": {
    "module": "node16",
    "moduleResolution": "node16",
    "target": "ES2023",
    "rootDir": ".",
    "outDir": "dist",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["lib/**/*.ts", "generated/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

The import rewrite, rule by rule (90 specifiers, 68 files, measured 2026-11-19):

| Today | After |
|---|---|
| `<any depth>/generated/prisma/client` (65, in api, auth, worker) | `@astrum/db/client` |
| `<any depth>/generated/prisma/enums` (24, in api and auth) | `@astrum/db/enums` |
| `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts:5` `internal/prismaNamespace` (1) | `Prisma.PrismaClientKnownRequestError` taken from `@astrum/db/client` |

An import written as `import type` stays `import type`. The 35 `jest.mock(… lib/prisma …)` calls in the gateway suites point at the app's own `lib/prisma.ts`, which stays, so none of their paths change; 34 of them sit four levels deep (`"../../../../lib/prisma"`) and one three levels deep, which is exactly the kind of path a blind rewrite breaks. Inside `packages/Astrum-db` nothing is rewritten: `lib/*.ts`, `prisma/seedFromExcel.ts` and `scripts/*.ts` keep their relative paths into `generated/prisma` and compile together with it.

Dockerfile deltas, identical for `apps/api-astrum`, `apps/auth-astrum` and `apps/worker`:

```dockerfile
# builder stage, replaces `RUN pnpm --filter <app> prisma:generate`
RUN pnpm --filter @astrum/db build
RUN pnpm --filter <app> build
```

The comment above the placeholder `DATABASE_URL` (line 22 in all three files) currently reads `# Placeholder only: prisma generate must never reach a real database.` and is reworded to say `the package build` instead, so no step that greps for `prisma generate` matches a comment.

Keep the placeholder `ENV DATABASE_URL="postgresql://build:***@127.0.0.1:5432/build?schema=public"` in the builder: `packages/Astrum-db/prisma.config.ts` reads `env("DATABASE_URL")` while loading the config, and generate never connects, but the variable has to exist.

```dockerfile
# runner stage
COPY --from=builder /app/apps/<app>/dist ./apps/<app>/dist
COPY --from=builder /app/packages/Astrum-db/dist ./packages/Astrum-db/dist
```

In `apps/worker/Dockerfile` the line `COPY --from=builder /app/apps/worker/generated ./apps/worker/generated` is deleted.

`turbo.json` after the change: `build` and `dev` depend on `["^build"]` with `^db:generate` removed, `check-types` depends on `["^build", "^check-types"]`, `test` keeps `["^build"]`, and the `db:generate` task stays uncached for manual runs. Root `package.json` loses `prisma:generate`, and each app loses its own `prisma:generate` script.

One trap worth naming: `apps/auth-astrum/tsconfig.json` sets `rootDir: "../.."`, which is why `nest build` emits `dist/src/main.js`. That setting exists only because the generated client used to sit outside `src`. Leave it exactly as it is: pointing `rootDir` at `src` would move the output to `dist/main.js` and break `nest-cli.json` `entryFile` and the container command, for no gain.

**Value sourcing** (every value this change must produce names its source):

| Value produced | Source |
|---|---|
| the one schema path | `packages/Astrum-db/prisma/schema.prisma`, today's source of truth |
| the module format of the emitted client | `moduleFormat = "cjs"` and `importFileExtension = "js"` in the generator block, decided here and reproduced on 7.10.1 |
| the hash that proves `dist` matches the schema | `dist/.schema-hash`, written by `scripts/writeSchemaHash.mjs` during the build |
| the `.env` path used by `lib/prisma.ts` | `__dirname` beside `dist/lib` plus `../../.env`, decided here |
| the import specifiers | the `exports` map of `packages/Astrum-db/package.json`, decided here |
| the build edge that keeps the client fresh | `dependencies["@astrum/db"] = "workspace:*"` in each app, plus `^build` in `turbo.json` |
| the pool size of one process | `DB_POOL_SIZE` from each service's own env, unchanged |
| how the image finds the client | `node_modules/@astrum/db` symlink plus the copied `packages/Astrum-db/dist` |

**Key invariants**:

- One schema file, one `prisma generate`, one client per process. The generated folder is never committed.
- The published types come from `dist/*.d.ts` and never from `lib/*.ts`, so a consumer cannot silently receive `any`.
- No app runs the Prisma CLI; the package owns migrations and generation.

**Configuration required**: none. No new environment variable, and `DATABASE_URL` and `DB_POOL_SIZE` keep their current readers.

**Critical test scenarios**:

- Happy path: fresh clone, `pnpm install`, `pnpm db:generate`, `pnpm quality-gate` exits 0, and every app resolves its client from the package, verifies **AC-2**, **AC-4**, **AC-5**, **AC-8**.
- Failure case: `packages/Astrum-db/dist` deleted, then `pnpm --filter @astrum/auth check-types` and `pnpm --filter @astrum/api test` both fail instead of passing on a stale or `any` client, verifies **AC-3**.
- Deployment case: `pnpm docker:prod:build` then `pnpm docker:prod:up`, `/health` answers `200` on api, auth and worker, and `require.resolve('@astrum/db/client')` succeeds inside the api container, verifies **AC-7**.

## Build plan

Order follows the project approach, Tracer Bullet: one service is carried end to end through every layer first, then the other two follow in one pass. No database migration is part of this feature.

1. Give the schema one owner: add `moduleFormat = "cjs"` and `importFileExtension = "js"` to the generator block, delete the three `apps/<app>/prisma/` folders and the three `apps/<app>/prisma.config.ts` files at the app roots, and drop `prisma` from the three apps' `devDependencies` together with their `prisma:generate` scripts, satisfies **AC-1**.
2. Make the package build itself: `tsconfig.build.json` and `tsconfig.check.json`, `main` and `types` removed and the two entry `exports` map, `build` writing `dist/.schema-hash`, `verify:build` checking versions, export targets and that hash, `quality-gate` running the guard, the two nested `{"type": "module"}` manifests under `prisma/` and `scripts/`, and `lib/prisma.ts` reading its `.env` fallback from `__dirname`, satisfies **AC-2**, **AC-3**.
3. Wire the graph: `"@astrum/db": "workspace:*"` in `dependencies` of the three apps, `build` and `dev` losing `^db:generate` and taking `^build` in `turbo.json`, `check-types` taking `^build`, and the root `prisma:generate` script deleted, satisfies **AC-4**.
4. Carry the thin thread through the gateway: rewrite the 55 files under `apps/api-astrum` to `@astrum/db/client` and `@astrum/db/enums`, keep `lib/prisma.ts` constructing its own client, then `pnpm --filter @astrum/api check-types` and its jest suite, satisfies **AC-5**, **AC-6**, **AC-8**.
5. Put the gateway on an image: builder runs the package build then the app build, runner copies `packages/Astrum-db/dist`, then `docker compose -f docker-compose.prod.yml build api`, start it and read `/health`, satisfies **AC-7**.
6. Bring auth and worker over in one pass: 5 files in auth with the internal import replaced and `PrismaService` keeping its `extends`, 3 files in worker, both images updated the same way, worker stops copying `generated`, satisfies **AC-5**, **AC-6**, **AC-7**.
7. Prove the whole thing: `pnpm quality-gate` from the root, `pnpm docker:prod:build` for the four images, `pnpm docker:prod:up` and `/health` on api, auth and worker, satisfies **AC-7**, **AC-8**.

## Consequences

**Positive**:

- One schema and one generated client, so a schema change cannot leave a third service on an old copy.
- The package finally carries its weight: today it holds the migrations and is imported by nobody.
- Every image builds the same client the tests built, because generation happens once, in the package build.

**Negative / tradeoffs**:

- The apps gain a build dependency: types and tests need `dist`, so `check-types`, `test` and the image builds all wait for the package build. A stale `dist` now fails loudly instead of being regenerated invisibly.
- The package moves from ESM types to emitted CommonJS, which is a real conversion: `import.meta` disappears, and the tsconfig has to emit rather than only type check.
- Three Dockerfiles gain a copy step of a folder that did not exist before, and anyone debugging an image now has to know that `packages/Astrum-db/dist` is the client.
- A new service must add one dependency edge and one Dockerfile line; forgetting either fails late, at build time.
- The package now needs three small artifacts to keep its own tooling alive: a hash file in `dist`, and nested `{"type": "module"}` manifests so three ESM only files keep working after the package turns CommonJS.

**Neutral**:

- The generated folder stays ignored, and `.dockerignore` keeps `**/dist`, so both are still produced inside the build rather than shipped from a laptop.
- The package singleton keeps existing for the seed script only.

## Migration plan

**Strategy**: big bang inside one feature branch, phased in the build order above.
**Phases**:
1. Package builds itself and the graph is wired, with no app switched yet, so `pnpm quality-gate` stays green on the old imports.
2. The gateway switches and its image proves the shape.
3. Auth and worker switch in one pass, then the four images are built and the stack is brought up.
**Rollback**: revert the commits of this feature and rebuild the images; no database change is involved, so no data rollback and no downtime window beyond the image rebuild.
**Risks**: an import the grep misses (a dynamic `require`, a `jest.mock` path, a seed script), the ESM to CommonJS conversion in `lib/prisma.ts`, and a Docker layer cache that hides a stale `dist` copy.

## Follow-up

- [ ] `/sync` must correct three statements this feature makes false: root `AGENTS.md` (the note that a fresh install needs `pnpm db:generate` for every client), `packages/Astrum-db/AGENTS.md` (the gotcha that every consumer generates its own copy and that an edit must be copied to three files) and `apps/worker/AGENTS.md` (that its schema is a byte identical copy).
- [ ] `@prisma/client` can leave the three apps once a build proves the generated declarations resolve through the package; this spec leaves it in place rather than bundle that experiment.
- [ ] The storefront keeps its hand written enum mirrors (spec 0029). Reading them from `@astrum/db/enums` is a separate feature, because it changes a Next build rather than a Node build.
- [ ] A repository with CI workflows should run the package build before any app suite; there are no workflows in the tree today.
- [ ] The guard proves the client exists and matches the schema, not that its types are real. A compile probe, one fixture that must fail on a field the schema does not have, would prove the never `any` invariant end to end and belongs in the package's suite once the build is green.

Reasoning and options: see [rationale.md](rationale.md).
