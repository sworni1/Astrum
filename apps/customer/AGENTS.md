# Customer storefront

## Overview

Next.js App Router storefront for the Astrum shop. Server components fetch on the server, the browser reaches the backend through the `/api-gateway/*` rewrite, and the `__auth` cookie carries the session.

## Stack

- Next.js 16 App Router, React 19.3, TypeScript 7 (`tsc`); Turbopack is the default bundler
- Tailwind CSS 4 with shadcn and Radix primitives, `class-variance-authority`, `lucide-react`, `sonner`
- Forms: `react-hook-form` with `zod` resolvers. Data: `swr` plus server fetchers
- Tests: vitest with jsdom, `@` alias maps to `src`

## Key files

| File                            | Owns                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `next.config.ts`                | `/api-gateway/:path*` rewrite to `API_GATEWAY_INTERNAL_URL`, allowed image hosts and qualities, no eslint key (removed in Next 16) |
| `src/app/(content)/`            | store pages: home, categories, product, cart, orders, profile, wishlist                                                            |
| `src/app/(auth)/`               | sign in and register pages                                                                                                         |
| `src/proxy.ts`                  | route guard reading the `__auth` cookie (Next 16 renamed `middleware` to `proxy`)                                                  |
| `src/common/helpers/session.ts` | cookie read, set, refresh and delete                                                                                               |
| `src/features/pages/<Page>/`    | page level feature components                                                                                                      |
| `src/hooks/<domain>/`           | data hooks per domain, exported through `index.ts`                                                                                 |

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

## Gotchas

- `apps/customer/.git` is a separate repository with its own initial commit, so git run inside this folder no longer sees the monorepo history.
- The folder `apps/customer/e:/Astrum` is leftover junk from an absolute path created relative to the workspace root.
- Apollo Client packages are installed but no source file imports them; the data layer is SWR plus server fetchers.
- Next 16 removed `next lint` and the `eslint` config key; lint runs as `eslint .` through `eslint.config.mjs` (flat config), so `next build` never lints.
- `images.qualities` lists `85` explicitly: Next 16 defaults to `[75]` and rejects unlisted `quality` values.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
