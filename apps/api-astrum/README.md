# api-astrum

Express API для Astrum (порт по умолчанию **3580**).

## Запуск из корня монорепо

```bash
pnpm dev:api
```

## Переменные окружения

Скопируй `.env.example` в `.env` и подставь значения.

| Переменная         | Назначение                                          |
| ------------------ | --------------------------------------------------- |
| `DATABASE_URL`     | PostgreSQL                                          |
| `JWT_SECRET`       | Подпись JWT                                         |
| `AUTH_SERVICE_URL` | URL сервиса auth (например `http://localhost:4580`) |

## Связанные пакеты

- Prisma и схема: `packages/Astrum-db`
