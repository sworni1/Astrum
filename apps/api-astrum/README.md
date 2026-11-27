# api-astrum

The Express API for Astrum (default port **3580**).

## Running it from the monorepo root

```bash
pnpm dev:api
```

## Environment variables

Copy `.env.example` into `.env` and fill in the values.

| Variable                | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL                                                              |
| `DB_POOL_SIZE`          | Postgres pool of one replica, default `10`                              |
| `JWT_SECRET`            | JWT signing; must match the auth service                                |
| `REDIS_URL`             | Session store; the service does not start without it                    |
| `RABBITMQ_URL`          | Event broker; the service does not start without it                     |
| `AUTH_SERVICE_URL`      | Auth service URL ending in `/api/auth`, for example `http://localhost:4580/api/auth` |
| `STRIPE_SECRET_KEY`     | Payment provider key                                                    |
| `STRIPE_WEBHOOK_SECRET` | Payment webhook signature key                                           |
| `STOREFRONT_URL`        | Public storefront origin used in the Stripe return URLs                 |
| `CACHE_ENABLED`         | `false` turns the catalogue cache off entirely                          |
| `CACHE_REDIS_URL`       | Cache Redis URL; empty falls back to `REDIS_URL`                        |
| `CORS_ALLOWED_ORIGINS`  | Comma separated origins; empty keeps the localhost defaults             |
| `RATE_LIMIT_ENABLED`    | `false` turns the built-in rate limit off                               |

## Related packages

- Prisma and the schema: `packages/Astrum-db`
