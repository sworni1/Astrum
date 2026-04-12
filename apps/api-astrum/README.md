# api-astrum

Express API для Astrum (порт по умолчанию **3580**).

## Запуск из корня монорепо

```bash
pnpm dev:api
```

## Переменные окружения

Скопируй `.env.example` в `.env` и подставь значения.

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET` | Подпись JWT |
| `AUTH_SERVICE_URL` | URL сервиса auth (например `http://localhost:4580`) |
| `SENTIMENT_SERVICE_URL` | URL сервиса тональности (`http://127.0.0.1:8088`), см. `apps/sentiment-astrum` |

Если `SENTIMENT_SERVICE_URL` не задан, при создании отзыва поле `sentiment` в ответе будет с меткой `UNKNOWN`.

## Связанные пакеты

- Prisma и схема: `packages/Astrum-db`
