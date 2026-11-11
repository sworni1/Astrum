# Customer storefront

## Overview

Next.js App Router storefront for the Astrum shop. Server components fetch on the server, the browser reaches the backend through the `/api-gateway/*` rewrite, and the `__auth` cookie carries the session.

## Stack

- Next.js 16 App Router, React 19.3, TypeScript 7 (`tsc`); Turbopack is the default bundler
- Tailwind CSS 4 with shadcn and Radix primitives, `class-variance-authority`, `lucide-react`, `sonner`
- Forms: `react-hook-form` with `zod` resolvers. Data: `swr` plus server fetchers
- Tests: vitest with jsdom, `@` alias maps to `src`

## Key files

| File                                      | Owns                                                                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts`                          | `output: "standalone"`, `outputFileTracingRoot` at the workspace root, `/api-gateway/:path*` rewrite to `API_GATEWAY_INTERNAL_URL`, allowed image hosts and qualities, no eslint key (removed in Next 16) |
| `src/app/(content)/`                      | store pages: home, categories, product, cart, orders, profile, wishlist                                                                                                                                   |
| `src/app/(auth)/`                         | sign in and register pages, plus `auth/confirm-email` for the letter link                                                                                                                                 |
| `src/features/auth/ConfirmEmail/`         | "check your mail" screen with the resend countdown                                                                                                                                                        |
| `src/features/layout/ConfirmEmailBanner/` | banner that tells a `PENDING` account why orders are refused                                                                                                                                              |
| `src/proxy.ts`                            | route guard reading the `__auth` cookie (Next 16 renamed `middleware` to `proxy`)                                                                                                                         |
| `src/common/helpers/session.ts`           | cookie read, set, refresh and delete                                                                                                                                                                      |
| `src/features/pages/<Page>/`              | page level feature components                                                                                                                                                                             |
| `src/hooks/<domain>/`                     | data hooks per domain, imported by module path                                                                                                                                                            |
| `src/app/health/route.ts`                 | `GET /health` for the balancer; reports `os.hostname()`, since `HOSTNAME` is pinned to the bind address                                                                                                   |
| `docker/graceful.cjs`                     | container entry wrapper that drains in flight requests on SIGTERM (the standalone server has no handler)                                                                                                  |

## Commands

```bash
pnpm --filter @astrum/customer dev
pnpm --filter @astrum/customer build
pnpm --filter @astrum/customer test
pnpm --filter @astrum/customer lint
```

## Conventions

- Route groups separate the auth layout from the content layout; a new page joins the matching group.
- Components are organised by feature: a PascalCase folder under `src/features`, shared primitives in `src/components/ui`.
- Backend calls go through a hook in `src/hooks/<domain>`, never inline inside a component.
- Signing out calls `POST /api/auth/logout` first and only then clears the `__auth` cookie, so the session is revoked on the server.
- A `403 EMAIL_NOT_CONFIRMED` response is not a generic error: it means the account still sits in `PENDING` and the screen points at the confirmation banner.
- Only `NEXT_PUBLIC_*` values reach the browser; the JWT secret stays on the server.
- In the container both gateway values are baked at build time: `API_GATEWAY_INTERNAL_URL=http://proxy:3580` (the rewrite is compiled into the routes manifest) and `NEXT_PUBLIC_API_GATEWAY_URL=/api-gateway`, which keeps the call same origin so the `__auth` cookie is sent without a CORS allowlist.

## Coding standard

Every file under `src` follows S1 to S5. `src/components/ui/**` is vendored shadcn and stays outside the standard. Test files follow every rule except the 400 line ceiling of S1. Files outside `src` (`next.config.ts`, `eslint.config.mjs`, `next-env.d.ts`) are outside the standard. The review form of these rules is in [CODE_REVIEW.md](CODE_REVIEW.md): a review comment cites the rule id instead of arguing taste.

### S1. One file, one job

A file holds one component or one module of pure functions. Everything that can be named and imported on its own lives in its own file: a constant, a lookup table, a label map, a style class constant, a variant map, a pure function, a type used beyond the component's own props, and every child component big enough to deserve a name. A component file keeps markup, its local state, its handlers and the hook calls that feed them. Split the same way inside a file: a function that mixes two jobs (a handler that also formats, a component body that also decides what to render) splits at that boundary. There is no line target to chase, so a coherent 150 line component is not fragmented for a number; the rule is extraction. The safety net: ESLint fails a non test file above 400 lines of code, blank lines and comments not counted.

### S2. Feature folder shape

A feature lives at `src/features/<area>/<Feature>/` and keeps only the folders it needs: `index.tsx` composition, `components/` one component per file, `lib/` constants and pure code, `hooks/` the feature's own state. `index.tsx` imports children, may call the feature's own hooks and a translator, and holds no state, handlers, tables or helpers. A `lib/` file holds lookup tables, pure helpers, style constants and local types, and carries a test when it branches or maps inputs to outputs. A backend call is not a feature hook: it goes through `src/hooks/<domain>`. A component file is `PascalCase.tsx`, a module is `kebab-case.ts`, and `index.tsx` is a feature or folder entry.

### S3. Placement

A constant, a table or a helper with one consumer lives in that feature's `lib/`, never in `src/common/`. `src/common/` holds what two or more features use, or what the cross layer owns: `helpers/`, `types/`, `zodSchemes/`, `constants/`. `src/lib/utils.ts` keeps `cn` because shadcn imports it from there, and no other file joins it. A barrel (`index.ts`) is allowed only as a feature's public surface, and the tree carries none today, so new code and every existing import name the module that exports the symbol: `@/common/helpers/showToast`, not `@/common`.

### S4. Side effects, money and dates

No `showToast`, `router.push`, `document` access or DOM write runs in a render body, and no DOM write behind React runs anywhere, handlers included: a refusal or a failed read surfaces as a toast raised from a handler or an effect plus a rendered state, never a silent `return null`. A user facing amount prints through `formatMoney(amount, currency)` from `src/common/helpers/money.ts`; `toFixed`, a currency symbol in JSX and `getCurrencyEmoji` used as an amount renderer are not amounts. A date shown as content prints through `useFormatter` from next-intl; a date input may use `date-fns` to parse and validate the typed string.

### S5. Imports and one formatter

`@/...` for every import outside the current folder, and `../` never appears: a relative path stays inside the folder (`./money`, `./components/CartCard`); ESLint enforces it. Translation JSON outside `src` is reached through the `@messages/*` alias. Biome 2 formats the root and this package: no package level `prettier`, no `linper` alias and no second formatter config. `pnpm format` runs `biome format --write` and then `biome check --write --only=organizeImports`; `format:check` runs `biome format <globs>` with no `--check` flag, which Biome 2 removed. The pre-commit hook stays `exit 0` on purpose, so formatting is manual.

### Enforcement

Three rules carry the machine checkable part: `max-lines` at 400 code lines, `no-console` allowing `console.error`, and `no-restricted-imports` for `../**`. One config exception is written in `eslint.config.mjs`: `max-lines` is off for test files. `eslint-suppressions.json` is committed and only shrinks; its baseline is empty today, because the two `console` sites that existed when the rules landed now log through `console.error` and `npx eslint . --prune-suppressions` emptied the file. A site that must be baselined comes with `--suppress-rule <rule>`, and the change that fixes it runs `--prune-suppressions` in the same commit, because a stale entry fails the run. `linterOptions.noInlineConfig` makes every `eslint-disable` comment inert inside `src`, so a suppression never hides a violation; a case that genuinely needs a rule turned off changes this standard first.

## Gotchas

- `apps/customer/e:/Astrum` is leftover junk from an absolute path created relative to the workspace root. It is excluded in the root `.dockerignore`, so it never reaches an image.
- Apollo Client packages are installed but no source file imports them; the data layer is SWR plus server fetchers.
- Next 16 removed `next lint` and the `eslint` config key; lint runs as `eslint .` through `eslint.config.mjs` (flat config), so `next build` never lints.
- `images.qualities` lists `85` explicitly: Next 16 defaults to `[75]` and rejects unlisted `quality` values.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
