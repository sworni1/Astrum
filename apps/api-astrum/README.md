# api-astrum

The Express API for Astrum (default port **3580**).

## Running it from the monorepo root

```bash
pnpm dev:api
```

## Environment variables

Copy `.env.example` into `.env` and fill in the values.

| Variable           | Purpose                                              |
| ------------------ | ---------------------------------------------------- |
| `DATABASE_URL`     | PostgreSQL                                           |
| `JWT_SECRET`       | JWT signing                                          |
| `AUTH_SERVICE_URL` | The auth service URL (for example `http://localhost:4580`) |

## Related packages

- Prisma and the schema: `packages/Astrum-db`
