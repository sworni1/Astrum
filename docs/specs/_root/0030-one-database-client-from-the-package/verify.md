# 0030. Verify: one database client from the package

Run every step from the repository root unless it says otherwise. Preconditions: `pnpm install` done, the dev containers up (`pnpm db:up`), and `pnpm db:generate` run once.

Each step states what it proves and what a failing answer looks like. A step passes only when the printed output matches the expectation; "no output" is a pass only where the step says so.

## Step 1: one schema, one Prisma CLI (AC-1)

1. `find . -name 'schema.prisma' -not -path './node_modules/*' -not -path '*/generated/*'`
   Expect exactly `./packages/Astrum-db/prisma/schema.prisma`. Any `apps/*` line means a copy survived.
2. `find . -name 'prisma.config.ts' -not -path './node_modules/*'`
   Expect exactly `./packages/Astrum-db/prisma.config.ts`.
3. `grep -nE 'moduleFormat|importFileExtension' packages/Astrum-db/prisma/schema.prisma`
   Expect two lines, `moduleFormat = "cjs"` and `importFileExtension = "js"`. One line only is the defect that makes `tsc` refuse the generated `./enums.ts` imports.
4. `diff <(sed -E 's/^  (moduleFormat = "cjs"|importFileExtension = "js")$//' packages/Astrum-db/prisma/schema.prisma) <(git show HEAD:packages/Astrum-db/prisma/schema.prisma)`
   Expect no output, which proves the file changed in those two lines only and no model or enum moved.
5. `grep -n '"prisma"\|prisma:generate' apps/*/package.json`
   Expect no output: neither the CLI nor its script survives. Then `pnpm --filter @astrum/api exec prisma --version` must fail with a command not found style error, not print a version.

## Step 2: the package builds itself (AC-2)

1. `node -e "const p=require('./packages/Astrum-db/package.json');console.log(p.type, p.main, p.types, Object.keys(p.exports))"`
   Expect `undefined undefined undefined [ './client', './enums' ]`. A `"module"` printed means `type` survived; a `main` or `types` value means the closed bare entry still has an entry point; a `"."` key means the bare entry survived.
2. `pnpm --filter @astrum/db build` exits 0, then
   `ls packages/Astrum-db/dist/lib/index.js packages/Astrum-db/dist/lib/index.d.ts packages/Astrum-db/dist/lib/prisma.js packages/Astrum-db/dist/generated/prisma/client.js packages/Astrum-db/dist/generated/prisma/client.d.ts packages/Astrum-db/dist/generated/prisma/enums.js packages/Astrum-db/dist/.schema-hash`
   Expect seven paths printed with no "No such file" line.
3. `git status --short packages/Astrum-db | grep -c dist`
   Expect `0`, so the build output stays out of git.
4. `cd packages/Astrum-db && node -e "require('@astrum/db')" ; echo exit=$?`
   Expect a non zero exit with `ERR_PACKAGE_PATH_NOT_EXPORTED`, which is the proof that the bare entry is closed while `./client` still resolves (next step).
5. `cd packages/Astrum-db && node -e "console.log(typeof require('@astrum/db/client').PrismaClient, typeof require('@astrum/db/client').Prisma.PrismaClientKnownRequestError)"`
   Expect `function function`.
6. `grep -n 'import.meta' packages/Astrum-db/lib/prisma.ts`
   Expect no output, and `grep -n '__dirname' packages/Astrum-db/lib/prisma.ts` expects one line.
7. `node -e "console.log(require('./packages/Astrum-db/prisma/package.json').type, require('./packages/Astrum-db/scripts/package.json').type)"`
   Expect `module module`, which is what keeps `import.meta.dirname` in the seed and the top level `await` in the two scripts alive after the package turns CommonJS.
8. `pnpm --filter @astrum/db seed:excel` starts without a `Cannot use import.meta` or `await is only valid` error (stop it once the first rows are read).

## Step 3: the stale client and the version split fail loudly (AC-3)

1. `pnpm --filter @astrum/db verify:build ; echo exit=$?`
   Expect `exit=0` with the built `dist` in place.
2. `mv packages/Astrum-db/dist "$TMPDIR/dist-away" && pnpm --filter @astrum/auth check-types ; echo exit=$? ; mv "$TMPDIR/dist-away" packages/Astrum-db/dist`
   Expect a non zero exit naming `@astrum/db`, not a clean pass. This is the failure the guard exists for.
3. Bump `@prisma/client` in `packages/Astrum-db/package.json` dependencies by one patch in the file, run `pnpm --filter @astrum/db verify:build ; echo exit=$?`
   Expect a non zero exit naming the two versions, then restore the file with `git checkout -- packages/Astrum-db/package.json`.
4. Staleness: append a harmless comment line to `packages/Astrum-db/prisma/schema.prisma`, run `pnpm --filter @astrum/db verify:build ; echo exit=$?`
   Expect a non zero exit naming the schema hash, because `dist` was built from another schema. Restore the file, rebuild, and expect `exit=0` again. This is the check that a green build cannot hide a stale client.

## Step 4: the graph and the pipeline (AC-4)

1. `grep -n '"@astrum/db"' apps/*/package.json`
   Expect three lines, one per app, each `"@astrum/db": "workspace:*"`.
2. `node -e "const t=require('./turbo.json');const j=JSON.stringify;console.log(j(t.tasks['build'].dependsOn), j(t.tasks['dev'].dependsOn), j(t.tasks['check-types'].dependsOn), j(t.tasks['test'].dependsOn))"`
   Expect `^build` in all four and `^db:generate` in none of them, because the package build generates the client itself and a second generate writing the same folder corrupts it.
3. `grep -n 'prisma:generate' package.json`
   Expect no output in the root scripts.
4. `pnpm turbo prune @astrum/api --docker --out-dir ./prune-check` exits 0, then
   `ls prune-check/full/packages/Astrum-db/package.json prune-check/full/packages/Astrum-db/prisma/schema.prisma`
   Expect both paths. Remove the folder afterwards with `rm -rf prune-check`.

## Step 5: imports come from the package (AC-5)

1. `grep -rn "generated/prisma" apps --include=*.ts --include=*.tsx`
   Expect no output.
2. `grep -rn "@astrum/db/client" apps --include=*.ts | wc -l` and `grep -rn "@astrum/db/enums" apps --include=*.ts | wc -l`
   Expect a count close to 65 and 24 respectively (the measured number of specifiers before the change). A count far below 65 means a file went its own way.
3. `grep -rn "internal/prismaNamespace" apps --include=*.ts`
   Expect no output, and `sed -n '1,10p' apps/auth-astrum/src/auth/strategy/jwt.strategy.ts` must show `Prisma.PrismaClientKnownRequestError` taken from `@astrum/db/client`.
4. `grep -rn "@astrum/db/prisma" apps packages --include=*.ts --include=*.mjs`
   Expect no output: the subpath is not published, and the seed reaches the singleton by relative path.

## Step 6: each service keeps its own client instance (AC-6)

1. `grep -n 'DB_POOL_SIZE' apps/api-astrum/lib/prisma.ts apps/worker/lib/prisma.ts apps/auth-astrum/src/prisma/prisma.service.ts`
   Expect three lines, one per file, so the pool setting did not move into the package.
2. `grep -n 'new PrismaClient\|extends PrismaClient' apps/api-astrum/lib/prisma.ts apps/worker/lib/prisma.ts apps/auth-astrum/src/prisma/prisma.service.ts`
   Expect three matches: `new PrismaClient` in the gateway and the worker, `extends PrismaClient` in auth with `super({ adapter })` a few lines below. Demanding three `new` calls would be wrong here, because the Nest service extends the class instead of instantiating it.

## Step 7: the images carry the built package (AC-7)

1. For each of the three Dockerfiles, `grep -nE '^RUN pnpm --filter (@astrum/db|<app>) build$|packages/Astrum-db/dist' apps/<app>/Dockerfile` expects the package build line before the app build line and one copy line for `packages/Astrum-db/dist`. `grep -n 'prisma generate' apps/<app>/Dockerfile` expects no output: the comment above the placeholder `DATABASE_URL` is reworded, so this check cannot pass on a comment.
2. `grep -n 'generated' apps/worker/Dockerfile`
   Expect no output, so the worker stopped copying its generated folder.
3. `pnpm docker:prod:build` exits 0 for the four images.
4. `pnpm docker:prod:up`, then probe each service from inside its own container, because only the proxy publishes a host port: `docker compose -f docker-compose.prod.yml exec api node -e "fetch('http://127.0.0.1:3580/health').then(r=>{console.log(r.status);process.exit(r.ok?0:1)})"` expects `200` and exit 0. Repeat for `auth` with port `4580` and for `worker` with port `5580`.
5. `docker compose -f docker-compose.prod.yml exec api node -e "console.log(require.resolve('@astrum/db/client'))"`, then the same for `auth` and `worker`.
   Expect a path under `/app/packages/Astrum-db/dist` in all three. A module not found error means that runner stage is missing the copy, and each service has its own Dockerfile, so each one is checked.

## Step 8: nothing that passed before fails (AC-8)

1. `pnpm quality-gate` from the root exits 0.
2. `pnpm --filter @astrum/api test` prints its suite total; compare it against the last full run (489 cases) and account for any change by a suite added with this feature.
3. `pnpm --filter @astrum/auth test` and `pnpm --filter @astrum/worker test` exit 0.
4. `pnpm --filter @astrum/worker test` with `packages/Astrum-db/dist` removed fails with a module error naming `@astrum/db`, which proves the worker resolves the client from the built package. Restore `dist` with `pnpm --filter @astrum/db build` afterwards.

## Step 9: the storefront is untouched

1. `git status --short apps/customer` prints nothing new, and `grep -rn "generated/prisma" apps/customer --include=*.ts --include=*.tsx` prints nothing, so the enum mirrors of spec 0029 stay as they are.
2. `pnpm dev` on the storefront boots and the product page renders, which is the cheap proof that nothing in the shared package leaks into the Next build.
