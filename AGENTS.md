## Learned User Preferences

- Communicates in Russian for Astrum project work; default to Russian in those discussions.
- React component files (tsx/jsx) must use PascalCase filenames, not kebab-case.
- Do not add code comments unless explicitly requested.
- Run lint after code changes (`pnpm lint`).
- Prefer chat/text outlines over auto-generated HTML presentations for academic or presentation material.
- New backend integrations should be proxied through `api-astrum`, following the same pattern as auth.
- Prefer dedicated React hooks for review-related UI logic instead of inline handlers.
- Revert unnecessary debug or fix churn when the root cause is external (for example VPN blocking local services).
- Use the hybrid workflow `pnpm dev:prod-fe` when the frontend should run from a production build while backends stay in turbo dev.
- Do not create git commits unless explicitly requested.

## Learned Workspace Facts

- Turborepo + pnpm 10.4 monorepo; workspace packages live under `apps/*` and `packages/*`.
- Apps: `customer` (Next.js 15), `api-astrum` (Express), `auth-astrum` (NestJS); shared DB package `@astrum/db` in `packages/Astrum-db`.
- `pnpm dev` starts the Postgres container then runs `turbo dev`; `dev:prod-fe` serves customer from a production build while api/auth use turbo dev.
- pnpm 10 blocks dependency build scripts by default; root `package.json` defines `pnpm.onlyBuiltDependencies` for esbuild, prisma, argon2, sharp, `@nestjs/core`, and related native packages.
- pnpm global store path is `E:\.pnpm-store\v10`.
- Default local ports: customer 3000, api 3580, auth 4580, postgres 5432.
- Request flow: browser → customer `/api-gateway/...` → api-astrum → auth service.
- Excel-based DB seeding runs via `pnpm --filter @astrum/db seed:excel` using `packages/Astrum-db/prisma/seedFromExcel.ts`.
- Project planning notes live in Obsidian vault `E:\Astrum\Astrum Vault` (for example `00-home/План по проекту.md`).
- GSD planning artifacts are stored under `.planning/` when using `/gsd-*` workflows.
