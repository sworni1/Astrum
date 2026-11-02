# 2026-11-02 · Dependency upgrade to latest across the monorepo

## Bumped

114 specifiers across the five `package.json` files, every direct dependency to its
published latest. Headline majors:

- `next` 15.4.2 → **16.4.3**, `eslint-config-next` to the same, `react` / `react-dom` 19.1 → 19.3.1
- `zod` 3.25 → **4.6.7**, `@hookform/resolvers` 3 → 7, `lucide-react` 0.469 → 1.66,
  `tailwind-merge` 2 → 3, `react-day-picker` 9 → 10, `date-fns` 3 → 4, `jsdom` 29 → 30
- `express` 4.22 → **5.3**, `http-proxy-middleware` 3 → 4, `axios` 1.13 → 1.21,
  `class-validator` 0.14 → 0.15, `dotenv` 17 → 18
- `eslint` 8 → **10**, `typescript-eslint` 8.15 → 8.72, `jest` 29 → 30, `vitest` 4.1.9 → 5.0.5,
  `@vitest/coverage-v8` matching, `supertest` 6 → 7
- `turbo` 2.9.5 → 2.11.10, `lint-staged` 16 → 17, `@commitlint/*` to 21.2.4
- `@prisma/*` 7.5/7.7 → 7.10.1, `argon2` → 0.45.1, `pg` → 8.23.1, `tsx` → 4.23.15

## Changed — framework adaptions

- **Next 16 `proxy`**: `apps/customer/src/middleware.ts` → `src/proxy.ts`, exported function
  `middleware` → `proxy`. The build now reports `ƒ Proxy (Middleware)`.
- **Next 16 config**: dropped the removed `eslint.ignoreDuringBuilds` key; added
  `images.qualities: [75, 85]` because Next 16 narrowed the default to `[75]` while
  `OptimizedImage` requests 85 — unlisted values are rejected.
- **Express 5**: `app.options('*')` → `app.options('/{*splat}')`. The bare `*` throws
  `Missing parameter name` at boot under path-to-regexp v8.
- **zod 4**: `z.string().email()` → `z.email()`, `.nonempty()` → `.min(1)`,
  `required_error` → `error`, `z.nativeEnum()` → `z.enum()` across the four schemas.
- **ESLint 10 / flat config**: both apps moved to flat config. `apps/auth-astrum/.eslintrc.js`
  is gone (ESLint 10 never reads it, so lint silently passed against zero rules);
  replaced by `eslint.config.mjs` with the `typescript-eslint` umbrella. The customer
  config drops the `FlatCompat` wrapper for `eslint-config-next/core-web-vitals` + `/typescript`.
- **Single source of truth for form types**: `SignUpCredentials` and `updateUserDto` are now
  `z.infer<typeof schema>` instead of hand-written types that had drifted (`nickName: string | null`
  against a schema producing `string | undefined`, optional vs required `email`). The stricter
  `@hookform/resolvers` 7 resolver types exposed the drift.
- **TypeScript 7 defaults**: `types` now defaults to `[]`, so `apps/api-astrum/tsconfig.json`
  declares `["node", "jest"]`. `baseUrl` is removed from the auth tsconfig (hard error in TS 7).
  `rootDir` defaults to `./`, which moved the auth build output to `dist/src/main.js`:
  `nest-cli.json` gained `entryFile: "src/main"` and `start:prod` points at the new path.
- **`useFetcher`**: the axios instance is created through `useState(createAxiosInstance)`
  instead of a ref mutated during render — the `react-hooks/refs` rule (react-hooks 7,
  React Compiler) rejects the old pattern.
- **`tailwind.config.js`**: `require("tailwindcss-animate")` → ESM import; the config is
  dead under Tailwind 4 (no `@config` directive) but still linted.

## Kept deliberately

- `prisma` / `@prisma/client` / `@prisma/adapter-pg` at **7.10.1**: the `latest` dist-tag
  currently points at `8.0.0-rc.29`, a release candidate. See ADR-0002.
- `@nestjs/*` at **11.2.8** and `@nestjs/config` at 4.0.4: NestJS 12 is ESM-only
  (`"type": "module"`), which would require rewriting the CommonJS service and its test
  runner. 11.1.18+ already closes the injection advisory. See ADR-0002.
- `xlsx` 0.18.5: no newer version is published to npm (SheetJS moved to its own CDN);
  0.19+/0.20+ fixes stay unavailable through the registry.

## Verified

- `pnpm check-types`: 4 of 4 packages, on the TypeScript 7 `tsc` binary (2.1 s total).
- `pnpm test`: 7 API tests, 7 auth tests, 1 vitest storefront test — all pass.
- `pnpm --filter @astrum/customer build`: Turbopack production build, 12 routes, proxy compiled.
- `pnpm --filter @astrum/auth build`: `nest build` emits `dist/src/main.js`.
- `pnpm --filter @astrum/customer lint`: 0 errors (13 warnings left by design).
