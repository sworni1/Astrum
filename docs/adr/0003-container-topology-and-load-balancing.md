# 0003: Container topology for replicated services behind Caddy

- **Status**: Accepted
- **Date**: 2026-11-03
- **Deciders**: repo owner
- **Related**: `docs/changelog/2026-11-03-docker-replicas-and-load-balancer.md`, `docker-compose.prod.yml`, `Caddyfile`

## Context

The repository shipped one `docker-compose.yml` that ran exactly one container per
service: `astrum-api` on 3580, `auth-service` on 4580, `frontend-astrum-customer` on
3000, every port published to the host. Three constraints pushed for a real topology:

1. **Replicas.** The owner wants horizontal replicas of the storefront and the API
   gateway, verified locally, so the same layout can be moved to a host unchanged.
2. **Single public entry.** A container that publishes `3580` gives the browser a second
   origin, which turns every API call into a cross-origin request and forces a hardcoded
   CORS allowlist per host.
3. **Portability.** Anything that only exists on the dev machine (a container the
   developer starts by hand, a hardcoded `localhost` hostname, a bind mount of the repo)
   breaks the move to a host.

State that would block replicas was audited first: the session is a JWT in the `__auth`
cookie (stateless), `apps/api-astrum` keeps no in-process state, and the order flow is
not implemented yet, so no in-memory cart or per-process lock exists today.

## Options considered

1. **Docker Swarm / Kubernetes** — real service discovery, rolling updates, replicas out
   of the box. Rejected: the owner asked for one `docker compose` command that works
   locally and on a host, and a single-machine deployment does not need a scheduler.
2. **Nginx with an `upstream` block** — needs the replica list written by hand or
   regenerated, and Nginx resolves upstream names once at startup (a scaled replica is
   invisible until reload). Rejected.
3. **Traefik with the Docker provider** — discovers replicas from container labels and
   balances over them. Viable, but it pulls in a label vocabulary and a dashboard to
   describe what is only two hops, and TLS/entrypoint wiring is more config than needed.
4. **Caddy `reverse_proxy` with a single upstream name** — the naive choice, and wrong:
   one `reverse_proxy customer:3000` resolves the compose DNS name once and keeps a
   single address, so requests are never spread. Rejected explicitly.
5. **Caddy `reverse_proxy` + `dynamic a`** (chosen) — Caddy re-resolves the compose DNS
   name every `refresh` interval, picks up every replica address, round-robins across
   them and drops an address whose `/health` fails.

## Decision

`docker-compose.prod.yml` is the deployment topology and `Caddyfile` is the only public
entry point:

```
browser -> proxy:80/443 -> customer x2
customer -> proxy:3580  -> api x3 -> auth x1 -> db
```

- **One image per service**, built with `turbo prune` (`apps/*/Dockerfile`,
  `packages/Astrum-db/Dockerfile`). The Prisma client is generated inside the image; the
  host copy is excluded by `.dockerignore`.
- **`migrate` runs once** before any service starts (`prisma migrate deploy`, gated by
  `service_completed_successfully`), so a replica never starts against a half-migrated
  schema.
- **Caddy holds two roles**: the public site (`{$DOMAIN:localhost}`, TLS automatic when
  `DOMAIN` is a real host) and the internal gateway balancer on `:3580`, which is never
  published to the host.
- **Customer talks to `proxy:3580`**, not to `api`, so replicas of the gateway are
  balanced too. `API_GATEWAY_INTERNAL_URL` is a build arg because Next compiles the
  rewrite into the routes manifest.
- **The browser uses relative `/api-gateway` URLs** (`NEXT_PUBLIC_API_GATEWAY_URL`), so
  the session cookie stays same-origin and no CORS allowlist is needed per host.
- **Prisma pool is bounded per replica** via `DB_POOL_SIZE` (3 x 10 + 1 x 10 = 40 of the
  Postgres 100 default).
- **Graceful shutdown**: api and auth close the HTTP server and disconnect Prisma on
  `SIGTERM`; customer is started through `docker/graceful.cjs`, which patches
  `http.Server#listen` so the Next standalone server drains before exit.
- **`/health` on all three services** returns the DB round trip (api, auth) and the
  instance id, which is what Caddy's `health_uri` and the compose healthchecks consume.

## Consequences

- **Positive**: one command starts the whole stack; replicas are verified locally with
  the same file used on a host; only `80`/`443` are published; a replica that dies is out
  of rotation within ~5–10 s; the API port can no longer be reached from outside, which
  removes a class of misconfiguration.
- **Negative**: `docker compose` has no rolling update, so a deploy briefly runs old and
  new replicas together — the two-step migration rule (add, then remove) is mandatory for
  breaking schema changes. Images are built on the deploying machine, so a slow host pays
  the build time.
- **Assumed**: replicas stay on one host, so SQLite-style local state must never appear.
  The order flow must run in a transaction with row locking — check #6 of the verification
  list stays open until it exists.
- **Debt accepted**: `apps/api-astrum`, `apps/auth-astrum` and `packages/Astrum-db` each
  keep their own copy of the Prisma schema; the migrate image uses the `Astrum-db` copy.
  They are semantically identical today and must be edited together.

## Update: the asynchronous side channels

Four services joined the stack after this record was accepted, and none of them changes the
decision above. They follow the same rules: one image per service, configuration from
`.env.prod`, a `GET /health` probe and a compose healthcheck gate.

- `redis` holds the session records: one `session:<sid>` per sign in, read by the gateway on
  every protected request. It runs without persistence on purpose, so a restart ends every
  live session. Decision and contracts: `docs/specs/_root/0004-session-store-in-redis/`.
- `rabbitmq` and `worker` carry the account confirmation letter. `auth` and `api` publish
  `account.confirmation.requested` after their commit, `worker` consumes the queue, writes
  the token hash and sends the letter through SMTP, retrying at 60, 300 and 900 seconds
  before the dead letter queue. Decision and contracts:
  `docs/specs/_root/0005-account-confirmation-by-email/`.
- `worker:5580` stays inside the `astrum` network. On `SIGTERM` it cancels the consumer,
  waits for the in flight send and closes the connection, which is what the compose
  `stop_grace_period` uses.
- `mailpit` is the SMTP catcher of the prod stack and the second service that publishes a
  host port (`8025`), next to `proxy` on `80`/`443`. A deployment that delivers for real
  points `SMTP_URL` at a relay and drops the service.
- The Prisma schema now has a copy in `apps/worker` as well: `apps/api-astrum`,
  `apps/auth-astrum`, `apps/worker` and `packages/Astrum-db` are byte identical today and
  must be edited together.
