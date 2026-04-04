# Pitfalls — Система отзывов + ML анализ

**Project:** Astrum Reviews System
**Mode:** Pitfalls dimension
**Confidence:** HIGH

## Domain-Specific Pitfalls

### 1. Fake Reviews / Spam (HIGH)

**Warning Signs:**
- Один пользователь оставляет 10+ отзывов за час
- Отзывы без связанного заказа
- Шаблоные тексты ("хороший товар", "отличный товар")

**Prevention Strategy:**
- `Review.orderItemId` — обязательная связь с OrderItem + статус DELIVERED
- Rate limiting: max 1 отзыв на OrderItem
- ML stub для спама: короткие тексты (< 5 слов) → flag
- Уникальность: один отзыв на один OrderItem

**Phase:** 1 (Prisma schema)

### 2. N+1 при агрегациях (HIGH)

**Warning Signs:**
- `Product.reviews.length` в цикле для каждого товара
- Каждый запрос продукта тянет все отзывы

**Prevention Strategy:**
- Кэшированные поля на Product: `reviewCount`, `stars`, `ratingDistribution`
- Обновление агрегатов при APPROVED через Prisma `$transaction`
- NEVER compute on the fly

**Phase:** 1 (schema design)

### 3. ML Service Unavailable (MEDIUM)

**Warning Signs:**
- Синхронный вызов ML при создании отзыва → таймауты
- Ошибка ML → ошибка всего эндпоинта

**Prevention Strategy:**
- Async fire-and-forget ML
- Stub fallback если сервис недоступен
- Retry queue для проваленных анализов

**Phase:** 4 (ML stub)

### 4. Photo Storage Not Ready (MEDIUM)

**Warning Signs:**
- Нет S3 или disk storage настроенного
- multer сохраняет в /tmp и файлы пропадают

**Prevention Strategy:**
- Отдельная фаза для storage setup
- MinIO для dev (Docker), S3 для prod
- Пресайнед URL для прямой загрузки

**Phase:** 2 (photo upload)

### 5. Frontend Reviews UI без готового API (MEDIUM)

**Warning Signs:**
- Начинаем верстать отзывы до готовности эндпоинтов
- Фронтенд мокит API и потом ломаются интеграции

**Prevention Strategy:**
- API first — эндпоинты и контракты до UI
- OpenAPI/Swagger для документации контрактов
- Фронтенд интегрирует в реальность

**Phase:** 6 (frontend only after API phases)

### 6. Moderation UI — где? (MEDIUM)

**Warning Signs:**
- Нет административной панели в current frontend
- Модераторам негде approve/reject отзывы

**Prevention Strategy:**
- Простые эндпоинты: GET /reviews/pending, POST /reviews/:id/approve
- Модерация через API или простой админ-страницей
- Не строить полноценную admin панель для MVP

**Phase:** 3 (moderation workflow)

### 7. ML Model Doesn't Handle Russian (MEDIUM)

**Warning Signs:**
- Натренировали на английском — русский не работает
- TF-IDF токенизация не учитывает морфологию

**Prevention Strategy:**
- Stub с русскими словами на этапе MVP
- NLTK punkt для русского языка в ML сервисе
- Датасет: Amazon Reviews + собранные русские отзывы

**Phase:** 5 (ML model training)

## Generic Pitfalls

### 8. Review Aggregates Inconsistent with Reviews (LOW)

**Prevention:** Обновление агрегатов в Prisma transaction при approve/reject.

**Phase:** 3

### 9. Deleting a Product with Reviews (LOW)

**Prevention:** Cascade или soft delete на Review.

**Phase:** 1 (Prisma schema)

### 10. Not Indexing Review Queries (LOW)

**Warning Signs:**
- Медленные запросы при загрузке отзывов
- Full table scan на `WHERE productId = ?`

**Prevention Strategy:**
- Индексы на: `productId`, `userId`, `orderItemId`, `status`
- Композитный индекс: `[productId, status]`

**Phase:** 1 (schema design)

---
*Last updated: 2026-04-04*
