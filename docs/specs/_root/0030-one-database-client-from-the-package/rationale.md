# 0030. One database client from the package: the decision record

## Context

The repository holds one Prisma schema in four byte identical copies, one in each app plus the shared package (measured 2026-11-19: `md5sum` of the four files is the same `5cec0dbaaf78a0237ce1363e6fcf4cbd`, 485 lines each). Each copy sits beside its own `prisma.config.ts` and its own `prisma` dependency, and each app generates a client into its own `generated/prisma` folder.

The generated client is plain TypeScript in Prisma 7, not a binary: the folder holds `client.ts`, `enums.ts`, `models/` and `internal/`, with no `.wasm` and no query engine file, because the driver adapter does the talking. The apps therefore compile the client as part of their own `tsc` run, and the runner stage of each image copies only `dist`, so the client travels inside the app's JavaScript.

Migrations live in one place already: `packages/Astrum-db/prisma/migrations`, 16 entries. The package also exposes a `PrismaClient` singleton with the pg adapter, and nobody imports it except its own seed script. So the package is the declared source of truth and is not used as one.

The cost of that shape is drift. `packages/Astrum-db/AGENTS.md` has to instruct a human to copy the file over after every edit, and the earlier attempt to share one client through a symlink failed: a generate from either side overwrote the other's client built from a schema that had drifted, and the two apps then disagreed about relation field names. A drift shows up as a failing suite in one app rather than as a clear error.

The constraint that shapes every option is the build, not the code. Each image starts from `pnpm turbo prune <app> --docker`, which keeps only the app and its declared dependencies, so a schema that no dependency edge reaches simply is not on the image. `.dockerignore` excludes `**/generated/prisma`, so the client is always generated inside the build. The three consumers compile to CommonJS, while the package declares `"type": "module"` and exports TypeScript sources.

## Options considered

### Option 1: keep the copies, guard them

Keep the four files and remove the manual step: a script copies the canonical schema into the three apps, each `preprisma:generate` runs it, and a hash check fails the hook that runs before a push when a copy drifts.

**Pros**:
- Cheapest change: one script plus a hook, no import touched, no Dockerfile touched.
- Four clients stay, so each app keeps its own `tsc` graph and its own `dist` layout unchanged.

**Cons**:
- The duplication and the four clients stay, which is the actual defect.
- A new app means another copy plus another hook entry, and the check only proves the files match, not that any app uses the shared package.

### Option 2: the package compiles itself, the apps import it

One schema in `packages/Astrum-db`. The package generates and compiles the client into CommonJS with declarations under `dist`, and publishes subpath entries. Each app declares `"@astrum/db": "workspace:*"`, imports `@astrum/db/client` or `@astrum/db/enums`, and keeps building its own `PrismaClient` with its own pool. The three images build the package and copy `packages/Astrum-db/dist` into the runner.

**Pros**:
- One schema, one generation, one client: drift becomes impossible rather than detected.
- It is the shape both reference sources describe for a workspace library that a plain `tsc` consumer builds.
- The prune graph and the images follow from the declared dependency edge, so nothing is hand maintained.

**Cons**:
- 90 import specifiers in 68 files change at once.
- The package becomes a build artifact: types and suites need `dist`, so the pipeline gains a real `^build` edge.
- The package converts from ESM types to emitted CommonJS, which touches `import.meta` in `lib/prisma.ts`.

### Option 3: one schema file with four generators

Keep one `schema.prisma` in the package and declare four `generator` blocks in it, each with its own `output` pointing into an app folder. Each service runs `prisma generate --schema ../../packages/Astrum-db/prisma/schema.prisma --generator <name>`. Prisma 7 accepts this: a schema may hold several generators, and `prisma generate --generator` selects one (confirmed against the installed CLI, 7.10.1).

**Pros**:
- No import changes and no `dist`, so the blast radius is a schema line plus one flag in three Dockerfiles.
- The drift disappears at the source, because there is one file.

**Cons**:
- The shared package starts carrying the paths of the apps, so the dependency points the wrong way and a new service edits the shared schema.
- Four clients still exist, and each Dockerfile must remember `--generator`, since without it the run emits all four.
- The apps keep their own `prisma generate`, so the package still is not the owner of the client.

## Rationale

Option 2 wins because the defect is duplication, and only it removes the duplication. Option 1 detects drift and leaves the cause in place; Option 3 hides the copies inside one file while keeping four generated clients and inverting the graph, which is the failure mode this repository already lived through once with a symlink.

The build constraint decides the shape inside Option 2. A turbo prune keeps a workspace package only when a dependency edge reaches it, so each app declares `workspace:*`; the client is TypeScript, so the package has to emit JavaScript instead of shipping sources, otherwise a runner started with `node` cannot load it; and the three consumers are CommonJS, so the emit is CommonJS with `moduleFormat = "cjs"` rather than a dual build nobody needs yet.

Two consequences are accepted on purpose. The pipeline gets a `^build` edge, so a type check or a suite waits for the package build; that is the price of the types being real rather than `any`. And the import rewrite happens in one pass, because leaving forwarding files behind would keep two ways to import the same client and postpone the only change that matters.

## Evidence measured on 2026-11-19

- Four schema copies, one md5 (`5cec0dbaaf78a0237ce1363e6fcf4cbd`), 485 lines each; 16 migration folders, all in `packages/Astrum-db/prisma/migrations`.
- 90 import specifiers naming `generated/prisma` in 68 files: 65 `client`, 24 `enums`, one `internal/prismaNamespace`. Per workspace: 55 files in `api-astrum`, 5 in `auth-astrum`, 3 in `worker`, 5 inside the package.
- Generated twice on 7.10.1 from a scratch copy of the schema: `moduleFormat = "cjs"` alone emits `import * as $Enums from "./enums.ts"`, which `tsc` refuses with TS5097; adding `importFileExtension = "js"` emits `./enums.js` with no `.ts` specifier left anywhere in the output.
- No imports of `@astrum/db` anywhere in `apps`: the package is never consumed today, whatever `AGENTS.md` says.
- The generated client holds only TypeScript sources, with no `.wasm` and no engine binary, because the pg adapter is installed.
- 35 `jest.mock(… lib/prisma …)` calls live in the gateway suites, 34 of them four levels deep; they point at the app's own `lib/prisma.ts` and are unaffected, but a blind path rewrite over `generated/prisma` strings would be the wrong tool.
- `apps/api-astrum/tsconfig.json` sets no `rootDir`, and `apps/auth-astrum/tsconfig.json` sets `rootDir: "../.."`, both because the generated client lives outside `src`; `apps/worker/tsconfig.json` excludes `generated` from the build and its Dockerfile therefore copies the folder next to `dist`.
- No CI workflows exist in the tree, so the pipeline in force is the hook before a push running `pnpm quality-gate`.
- Three files in the package cannot live without ESM: `import.meta.dirname` in `prisma/seedFromExcel.ts:256`, and a top level `await main()` in `scripts/assignBusiness.ts:97` and `scripts/pickupPoint.ts:128`. Dropping `"type": "module"` at the package root therefore needs a nested `{"type": "module"}` manifest in each of those two folders.
