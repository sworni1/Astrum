# Customer storefront

## Overview

Next.js App Router storefront for the Astrum shop. Server components fetch on the server, the browser reaches the backend through the `/api-gateway/*` rewrite, and the `__auth` cookie carries the session.

## Stack

- Next.js 16 App Router, React 19.3, TypeScript 7 (`tsc`); Turbopack is the default bundler
- Tailwind CSS 4 with shadcn and Radix primitives, `class-variance-authority`, `lucide-react`, `sonner`
- Forms: `react-hook-form` with `zod` resolvers. Data: `swr` plus server fetchers
- Tests: vitest with jsdom, `@` alias maps to `src`

## Key files

| File                            | Owns                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts`                | `output: "standalone"`, `outputFileTracingRoot` at the workspace root, `/api-gateway/:path*` rewrite to `API_GATEWAY_INTERNAL_URL`, allowed image hosts and qualities, no eslint key (removed in Next 16) |
| `src/app/(content)/`            | store pages: home, categories, product, cart, orders, profile, wishlist                                                                                                                                   |
| `src/app/(auth)/`               | sign in and register pages                                                                                                                                                                                |
| `src/proxy.ts`                  | route guard reading the `__auth` cookie (Next 16 renamed `middleware` to `proxy`)                                                                                                                         |
| `src/common/helpers/session.ts` | cookie read, set, refresh and delete                                                                                                                                                                      |
| `src/features/pages/<Page>/`    | page level feature components                                                                                                                                                                             |
| `src/hooks/<domain>/`           | data hooks per domain, exported through `index.ts`                                                                                                                                                        |
| `src/app/health/route.ts`       | `GET /health` for the balancer; reports `os.hostname()`, since `HOSTNAME` is pinned to the bind address                                                                                                   |
| `docker/graceful.cjs`           | container entry wrapper that drains in flight requests on SIGTERM (the standalone server has no handler)                                                                                                  |

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
- Only `NEXT_PUBLIC_*` values reach the browser; the JWT secret stays on the server.
- In the container both gateway values are baked at build time: `API_GATEWAY_INTERNAL_URL=http://proxy:3580` (the rewrite is compiled into the routes manifest) and `NEXT_PUBLIC_API_GATEWAY_URL=/api-gateway`, which keeps the call same origin so the `__auth` cookie is sent without a CORS allowlist.

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
