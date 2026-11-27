---
id: 0032
slug: extract-hackathon-scaffold
status: Proposed
adrs: [ADR-0003]
---

# Extract the Astrum skeleton into a standalone hackathon scaffold

## Problem

The RWB «Mesh-доставка с хранением в ПВЗ» hackathon (Положение, Приложение 1) needs a Dockerized marketplace with PVZ and seller applications, an order pipeline and five reproducible scenarios. Astrum already carries most of that domain (roles, pickup points, couriers, order handover, idempotent checkout), but it also carries a storefront, Stripe, reviews, cart, wishlist, an Excel catalogue import and a 30-spec documentation history — none of which the task asks for. Submitting Astrum as-is violates Положение п. 8.1/8.2 (a ready-made solution presented as hackathon work), drowns the demo in irrelevant surface, and makes the provenance of new code impossible to prove.

## Decision

Create a separate repository `astrum-mesh` containing only the vertical slice the task needs, extracted from Astrum as scaffolding, and freeze it at tag `scaffold-v0` before the hackathon starts. Every commit after that tag is provable hackathon work, and `ATTRIBUTION.md` lists what existed before.

Rejected alternative: a long-lived `hackathon/mesh` branch inside Astrum. Rejected because one repository cannot honestly separate "pre-existing" from "written at the hackathon" in `git log`, and because the hackathon demo must not ship Astrum's storefront or Stripe surface.

## Inventory

### Keep

| Path in Astrum | Becomes in `astrum-mesh` | Why |
| --- | --- | --- |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig*`, `biome.json`, `commitlint.config.js`, `.husky` | same | toolchain is already tuned, rebuilding it is a day lost |
| `packages/Astrum-db` | `packages/db` (`@mesh/db`) | one Prisma client, trimmed schema |
| `apps/api-astrum/src/modules/order` | `apps/api/src/modules/order` | `idempotencyKey` + `idempotencyHash` satisfy «сборка без повторного списания» |
| `apps/api-astrum/src/modules/pickup` | `apps/api/src/modules/pickup` | PVZ handover is scenario 1 |
| `apps/api-astrum/src/modules/staff` | `apps/api/src/modules/staff` | point worker and courier roles already wired |
| `apps/api-astrum/src/modules/shipping` | `apps/api/src/modules/shipping` | tariff source for the baseline-vs-mesh comparison |
| `apps/api-astrum/src/modules/seller` | `apps/api/src/modules/seller` | seller application required by п. 7.4 |
| `apps/api-astrum/src/modules/product` | `apps/api/src/modules/product` | lot and catalogue base |
| `apps/api-astrum/src/modules/user`, `middlewares/`, `session/`, `events/`, `common/` | same | auth, sessions, error shape, RabbitMQ publisher |
| `apps/auth-astrum` | `apps/auth` | test accounts with a real login, no Authorization header |
| `apps/worker` | `apps/worker` | notification path for long storage and incident alerts |
| `apps/customer` route groups `(auth)`, `(content)/orders`, `(content)/point`, `(content)/courier`, `(content)/staff`, `(content)/seller` | `apps/web` | the PVZ and seller applications п. 7.4 asks for |
| `packages/db/prisma/seed.ts` (new) | replaces Excel seeding | synthetic PVZ, businesses, products, lots, test accounts |

### Drop

| Path in Astrum | Reason |
| --- | --- |
| `apps/api-astrum/src/modules/payment/**` (config, gateway registry, webhook controller and service) | п. 7.3: payment gateway is explicitly out of scope |
| Stripe enums and models: `Payment`, `PaymentAttempt`, `PaymentProvider`, `PaymentAttemptStatus` | same |
| `apps/api-astrum/src/modules/cart`, `wishlist`, `guest` + `CartItem`, `WishlistItem`, `LastViewedProduct` | a shopper storefront is simulated, not built (п. 7.3) |
| `apps/api-astrum/src/modules/reviews` + `Review`, `ReviewLike`, `ReviewComment`, `ReviewResponse` | not part of the task |
| `apps/customer/src/app/(content)/{cart,categories,products,wishlist,checkout,profile}` | same, plus it removes the «принесли чужой магазин» impression |
| `packages/Astrum-db/prisma/seedFromExcel.ts`, `xlsx` dependency, `Бесплатная база товаров 2018`, `seed:excel`, `db:assign-business`, `db:pickup-point` scripts | synthetic data only; real catalogue is irrelevant and slows the image |
| `docker-compose.prod.yml`, `Caddyfile`, `.env.prod.example`, `proxy` service, `docker:prod:*` scripts | replicas behind Caddy are not required; one compose file is enough |
| `docs/scope/**`, `docs/specs/**`, `docs/adr/**` of Astrum, `apps/*/AGENTS.md`, `customer/CODE_REVIEW.md` | the scaffold gets its own fresh `AGENTS.md`, `README.md` and `docs/adr/0001` |
| `apps/*/generated/` | per-app client copies are rebuilt by `pnpm db:generate`; the scaffold ships none |
| `packages/Astrum-db/prisma/migrations` | Astrum's migration history describes a shop; the scaffold starts from one `0001_init` |
| `en` message files, second locale | the working language of the hackathon is Russian; one locale, no i18n matrix |
| `apps/customer/e:/Astrum` leftover directory | junk from a bad path, already a known gotcha |

## Acceptance criteria

1. `pnpm install && pnpm db:generate && pnpm quality-gate` exits 0 in a fresh clone of `astrum-mesh`.
2. `docker compose up -d` starts db, redis, rabbitmq, mailpit, migrate, api, auth, worker, web; `curl -s -o /dev/null -w "%{http_code}" localhost:3580/health` prints `200`.
3. `rg -i "stripe|paymentintent|wishlist|reviewlike|xlsx" apps packages -g '!node_modules'` returns no hits.
4. `find . -name schema.prisma -not -path "*/node_modules/*" -not -path "*/generated/*"` prints exactly one path: `packages/db/prisma/schema.prisma`.
5. `pnpm db:seed` run twice leaves the row counts of `PickupPoint`, `Product`, `User` unchanged.
6. Signing in as a seeded point worker and handing over a seeded order at `/point` moves it to `ISSUED` and stamps `handedOverAt`; `pnpm --filter @mesh/api test -t handover` passes.
7. `ATTRIBUTION.md` exists at the root, lists every module carried over from Astrum with its pre-hackathon origin, and `git tag scaffold-v0` points at the commit that added it.
8. `rg "Astrum" -i apps packages` returns no hits: the scaffold carries no Astrum naming that would imply the shop itself is the deliverable.

## Values

| Value shown / computed | Source |
| --- | --- |
| order status shown to the PVZ worker | `Order.status` / `OrderItem.status` enums in `packages/db/prisma/schema.prisma` |
| handover timestamp | `Order.handedOverAt`, set by `pickup.service.ts` |
| delivery price and ETA baseline | `ShippingMethod.price` seeded in `packages/db/prisma/seed.ts` |
| PVZ identity of the worker | `PointWorker.pickupPointId` resolved from `User.id` through the session cookie |
| seeded credentials for the demo | `packages/db/prisma/seed.ts` constants, mirrored into `README.md` |
| locale of every label | `ru` only, `apps/web/messages/ru.json` |

## Out of scope

- `StockLot`, `PickupPoint.capacity`, `StorageTariff`, `ShipmentRoute`, `RouteSegment`, `Accrual` and the `mesh-economics` package — these are the hackathon work and get their own spec (`0033-mesh-pvz-model`).
- The five demonstration scenarios as tests or scripts.
- Presentation, video demo and the economics spreadsheet.
- Any change to Astrum itself: this spec reads from it and writes into a new repository.

## Assumptions

- `Assumed:` the new repository lives at `E:\Hackathon\astrum-mesh` and is created local-only; publishing it is a separate decision.
- `Assumed:` removal of the second locale keeps `next-intl` in place with a single `ru` catalogue, rather than ripping i18n out of every component.
- `Assumed:` the seller application keeps Astrum's read-only sales panel; the hackathon adds analytics on top of it in spec 0033.
- `Assumed:` Astrum's git history is not transferred; the scaffold starts with a single `chore: scaffold from astrum` commit so `scaffold-v0` is unambiguous.

## Build plan

1. Create the repository and copy the tree without `node_modules`, `generated`, `.next`, `dist`, `.git`, `docs`.
2. Rename the workspace: `@astrum/*` → `@mesh/*`, `Astrum-db` → `db`, `apps/api-astrum` → `apps/api`, `apps/auth-astrum` → `apps/auth`, `apps/customer` → `apps/web`.
3. Delete the drop list and unwire it from `apps/api/src/app.ts`, `apps/web/src/proxy.ts`, the sidebar and the route groups.
4. Write the trimmed Prisma schema as the single source, one `0001_init` migration, `prisma/seed.ts` with synthetic PVZ, businesses, products, lots and accounts.
5. Collapse `docker-compose.prod.yml` into one `docker-compose.yml` with a `Dockerfile` per app, health checks and `.env.example` listing every key actually read.
6. Write `README.md`, `AGENTS.md`, `docs/adr/0001-scaffold-provenance.md`, `ATTRIBUTION.md`.
7. Run the gate, boot the stack, walk the handover flow, then `git tag scaffold-v0`.

## Verification

| AC | How to prove it |
| --- | --- |
| 1 | `rm -rf node_modules && pnpm install && pnpm db:generate && pnpm quality-gate` |
| 2 | `docker compose up -d && docker compose ps && curl -s -o /dev/null -w "%{http_code}" localhost:3580/health` |
| 3 | the `rg` command in the AC, pasted output |
| 4 | the `find` command in the AC, pasted output |
| 5 | `pnpm db:seed` twice, then `psql -c "select count(*) from \"PickupPoint\""` before and after |
| 6 | browser at `/point`, then `pnpm --filter @mesh/api test -t handover` |
| 7 | `cat ATTRIBUTION.md && git tag --list scaffold-v0 && git log --oneline scaffold-v0` |
| 8 | the `rg "Astrum"` command, pasted output |
