# Roadmap: Система отзывов товаров

**Milestone:** Reviews MVP
**Created:** 2026-04-04
**Progress:** 0%

## Phases

| # | Name | Status | Summary |
|---|------|--------|---------|
| 1 | Prisma Schema & Core CRUD | planned | Схема Review/ReviewResponse, CRUD эндпоинты, валидация OrderItem |
| 2 | Photo Upload & S3 Storage | not-started | MinIO dev, presigned URLs, sharp обработка, multer интеграция |
| 3 | Moderation Workflow | not-started | State machine PENDING→APPROVED/REJECTED, ML stub, агрегаты Product |
| 4 | ML Service (Python/FastAPI) | not-started | docker-сервис ml-astrum, scikit-learn TF-IDF + Naive Bayes |
| 5 | Frontend UI (Customer) | not-started | Форма отзыва, отображение отзывов, распределение рейтингов |
| 6 | Reply System & Enhancements | not-started | Ответы продавцов, голосование «Полезно», фильтры и сортировка |

## Dependencies

```
Phase 1 (CRUD) → Phase 2 (Photo) → Phase 5 (Frontend) → Phase 6 (Replies)
       ↘          ↗
    Phase 3 (Moderation)

Phase 4 (ML Service) — independent, can run in parallel
```

## Phase Order: 1 → (2, 3 parallel) → 4 → 5 → 6

## Phase 1 Plans

**Plans:** 1 plan
- [ ] 01-prisma-schema-core-crud-01-PLAN.md — Prisma schema + Reviews module (CRUD, purchase validation, cursor pagination, aggregates)
