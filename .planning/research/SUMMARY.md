# Project Research Summary

**Project:** Astrum Reviews System — Система отзывов с ML-анализом тональности
**Domain:** E-commerce product reviews + moderation + sentiment analysis
**Researched:** 2026-04-04
**Confidence:** MEDIUM-HIGH

## Executive Summary

Система отзывов для маркетплейса Astrum с обязательной привязкой к покупке, пре-публикационной модерацией и ML-анализом тональности. Рекомендуемый подход: Express API как основной бэкенд (CRUD, модерация, S3-хранилище), выделенный Python/FastAPI микросервис для ML (scikit-learn, TF-IDF + Naive Bayes), заглушка на ключевых словах как Phase 1 с последующей заменой на реальную модель. ML-анализ выполняется асинхронно (fire-and-forget) и не блокирует создание отзыва.

Ключевые риски: отсутствие S3-хранилища в текущей инфраструктуре (требуется отдельная фаза с MinIO), ML-заглушка имеет низкую точность для русского языка (митигируется ручной модерацией), отсутствие админ-панели для модераторов (решается минимальным UI в рамках MVP).

---

## Key Findings

### Recommended Stack

**Core backend (api-astrum):**
- Express 4.21.2 — уже используется, не менять
- Prisma 7.5.0 — ORM, новая схема Review/ReviewResponse
- `multer` ^2.0 + `@aws-sdk/client-s3` ^3.x + `sharp` ^0.34 — загрузка и обработка фото
- `uuid` ^11 — уникальные ID для загрузок
- `class-validator` ^0.14 — валидация (проектный стандарт)

**ML Service (новый воркспейс `services/ml-astrum/`):**
- FastAPI ^0.115 + uvicorn ^0.34 — HTTP API
- scikit-learn ^1.6 + pandas ^2.2 + nltk ^3.9 — анализ тональности
- Python dotenv ^1.0 — конфигурация

**Frontend (customer):**
- React 19 + shadcn/ui — уже используется
- `react-hook-form` — управление формой отзыва
- `lucide-react` — иконография звёзд

**Что НЕ использовать:**
- `jsonwebtoken` в Express — проект использует cookie-based JWT через auth-proxy
- Apollo Client — нет GraphQL-сервера
- Локальное хранилище для фото — мульти-сервисная архитектура требует S3
- Синхронный ML в цепочке создания — добавляет 200-2000ms latency
- `python-shell` / встроенный Python — жёсткая привязка, сложно масштабировать
- Celery / Redis — избыточно для MVP

### Expected Features

**Must have (table stakes):**
- Рейтинг 1-5 звёзд — базовая оценка товара
- Текстовый отзыв с привязкой к покупке — верифицированные покупатели
- Отображение на странице товара + средний рейтинг + распределение
- Имя автора и дата публикации

**Should have (competitive — P0 MVP):**
- Критериальные оценки (качество, доставка, соответствие) — P0
- Фотографии в отзывах (S3, presigned URLs) — P0
- Пре-публикационная модерация — P0
- ML-анализ тональности (v1 — заглушка) — P0
- Ответ продавца — P0
- Паттерн A модерации: ML-ассистент → очередь модератора → решение

**Defer (v2+):**
- Голосование «Полезно» — P1
- Расширенные фильтры — P1
- Редактирование/удаление отзыва — v2
- ML-теги и авто-публикация доверенных — v3
- Fine-tuned RuBERT модель — v3

### Architecture Approach

Асинхронный ML, Strategy pattern для подмены заглушки на реальную модель, кэшированные агрегаты на Product (reviewCount, stars, ratingDistribution), Review привязан к OrderItem для проверки покупки.

**Major components:**
1. **Review Module** (`api-astrum/src/reviews/`) — CRUD, проверка покупки
2. **Moderation Module** — State machine PENDING → APPROVED/REJECTED
3. **Photo Module** — Загрузка через S3 presigned URLs, обработка sharp
4. **ML Client** — Strategy: StubSentimentAnalyzer → MlSentimentAnalyzer (env flag)
5. **ML Service** (`services/ml-astrum/`) — Python FastAPI: POST /sentiment

**Data flow:** User POST → verify delivery → create review (PENDING) → fire-and-forget ML → модератор approve/reject → при approve: обновить Product агрегаты через Prisma $transaction → отзыв виден на странице.

**Build order (7 фаз):**
1. Prisma schema + CRUD (нет зависимостей)
2. Photo upload (требует storage) — параллельно с 3
3. Moderation workflow (требует CRUD) — параллельно с 2
4. ML stub (внутри API)
5. Python ML service (инфраструктура Docker)
6. Frontend UI (требует готовый API)
7. Reply system (дополнительная)

### Critical Pitfalls

1. **Fake Reviews / Spam** — обязательная Review.orderItemId связь с DELIVERED OrderItem, rate limiting (1 на OrderItem), stub-детекция коротких текстов (< 5 слов)
2. **N+1 при агрегациях** — кэшированные поля на Product, обновление через Prisma $transaction при approve/reject, НИКАКИХ compute-on-the-fly
3. **ML Service Unavailable** — асинхронный fire-and-forget, stub fallback, retry queue для проваленных
4. **Photo Storage Not Ready** — отдельная фаза storage setup: MinIO для dev, S3 для prod, presigned URLs
5. **ML не работает с русским** — stub с русскими словами на MVP, NLTK punkt для русского, датасет русскоязычных отзывов для тренировки

---

## Implications for Roadmap

### Phase 1: Database Schema & Core CRUD
**Rationale:** Фундамент — без схемы и базовых эндпоинтов ничего остального не работает. Нулевые зависимости.
**Delivers:** Prisma модели Review/ReviewResponse, индексы, кэшированные агрегаты на Product, CRUD эндпоинты, валидация привязки к OrderItem
**Addresses:** Создание отзыва, привязка к покупке, базовая модель данных
**Avoids:** Pitfall #1 (Fake Reviews) через orderItemId обязательность, Pitfall #2 (N+1) через кэширование, Pitfall #10 (отсутствие индексов)
**Research flags:** Нет — стандартная CRUD реализация

### Phase 2: Photo Upload & S3 Storage
**Rationale:** Требуется инфраструктура (MinIO/S3) перед тем как форма отзыва сможет включать фото. Параллельно с Phase 3.
**Delivers:** MinIO Docker-контейнер для dev, multer + S3 SDK на бэкенде, presigned URL flow, sharp для оптимизации изображений
**Addresses:** Фотографии в отзывах (P0 MVP)
**Avoids:** Pitfall #4 (Photo Storage Not Ready) через выделенную фазу настройки
**Research flags:** Нужна `/gsd:research-phase` — в проекте нет опыта работы с S3, нужно исследовать конфигурацию MinIO + S3 SDK

### Phase 3: Moderation Workflow
**Rationale:** Зависит от CRUD (Phase 1). Модерация — критический путь для публикации отзывов.
**Delivers:** State machine PENDING → APPROVED/REJECTED, эндпоинты модерации, обновление Product агрегатов через Prisma $transaction, ML stub (keyword-based sentiment)
**Addresses:** Пре-публикационная модерация, ML-заглушка, средний рейтинг + распределение
**Avoids:** Pitfall #3 (ML Unavailable) через stub fallback, Pitfall #8 (агрегаты неконсистентны) через transaction
**Research flags:** Нет — стандартный state machine

### Phase 4: ML Service (Python/FastAPI)
**Rationale:** Инфраструктурно независим, может собираться параллельно с Phase 3. Заменяет stub на реальную модель в v2.
**Delivers:** Docker-сервис ml-astrum на FastAPI, scikit-learn TF-IDF + Naive Bayes, NLTK русский токенизатор, endpoint POST /sentiment, joblib model persistence
**Addresses:** ML-анализ тональности (v2 — реальная модель)
**Avoids:** Pitfall #7 (ML не работает с русским) через NLTK + русский датасет
**Research flags:** Нужна `/gsd:research-phase` — подбор датасета для русского языка, настройка NLTK, выбор модели — нишевая область

### Phase 5: Frontend UI (Customer)
**Rationale:** Зависит от готовности API (Phase 1-3). Интеграция с реальными эндпоинтами, не моками.
**Delivers:** Форма отзыва (react-hook-form), компонент звёзд, отображение отзывов на странице товара, распределение рейтингов, UI модерации (минимальный)
**Addresses:** Все P0 фичи с фронтендовой стороны
**Avoids:** Pitfall #5 (Frontend без API) через API-first подход, Pitfall #6 (нет UI модерации) через минимальную админ-страницу
**Research flags:** Нет — стандартная React/Next.js реализация

### Phase 6: Reply System & Enhancements
**Rationale:** Дополнительная фича, не блокирует запуск MVP. Зависит от опубликованных отзывов.
**Delivers:** Ответы продавцов, голосование «Полезно», расширенные фильтры и сортировка
**Addresses:** Ответ продавца (P0), голосование (P1), фильтры (P1)
**Avoids:** Pitfall #9 (cascade delete) через правильные Prisma отношения
**Research flags:** Нет — стандартные CRUD + агрегации

### Phase Ordering Rationale

- **Порядок:** 1 → (2, 3 параллельно) → 4 → 5 → 6. Phase 1 критическая — без неё ничего не работает. 2 и 3 независимы друг от друга, но обе зависят от 1. Phase 4 (ML service) инфраструктурно независима и может вестись параллельно. Phase 5 ждёт готовый API. Phase 6 — polish после запуска.
- **Группировка:** Бэкенд (1-4) и фронтенд (5-6) разделены по архитектурным границам.
- **Избегание питфоллов:** API-first гарантирует, что фронтенд не работает с моками. Async ML предотвращает блокировку. Кэширование агрегатов решает N+1.

### Research Flags

**Phases, которым нужна `/gsd:research-phase`:**
- **Phase 2 (Photo Storage):** В проекте нет S3/MinIO опыта. Нужно исследовать конфигурацию presigned URLs, policy, CORS для прямого аплоада с клиента.
- **Phase 4 (ML Service):** Подбор русского датасета, настройка NLTK для морфологии русского языка, packaging Python-сервиса в монорепу.

**Phases со стандартными паттернами (можно без исследования):**
- **Phase 1:** Стандартная Prisma CRUD — документация хорошая, паттерны отработаны
- **Phase 3:** State machine модерации — распространённый паттерн
- **Phase 5:** React 19 + shadcn/ui формы — проект уже использует этот стек
- **Phase 6:** CRUD ответов — типичная реализация

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Версии проверены из package.json, но S3/MinIO в проекте отсутствуют |
| Features | HIGH | Чёткая приориризация P0/P1/P2, user journey описан детально |
| Architecture | HIGH | Strategy pattern для ML, async flow, Prisma schema — всё хорошо задокументировано |
| Pitfalls | HIGH | Domain-specific pitfalls хорошо идентифицированы с concrete prevention strategies |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **S3/MinIO конфигурация:** В проекте нет опыта с object storage. Нужно решить: MinIO только для dev или MinIO для prod тоже? Кто управляет бакетами и политиками доступа?
- **ML датасет для русского языка:** Нет готового корпуса ревью на русском. Нужно исследовать доступные датасеты (Amazon Reviews + перевод? RuReviews? Парсинг открытых источников?)
- **Moderation UI surface:** Существующий frontend не имеет admin-панели. Где размещать — в customer или новый workspace?
- **Node.js версия:** Inconsistency между Docker-образами (18 vs 20). Нужно привести к единой версии до начала работы.

---

## Sources

### Primary (MEDIUM-HIGH confidence)
- STACK.md — технологии, версии, rationale (версии проверены из package.json)
- FEATURES.md — анализ фич, user journey, приоритизация
- ARCHITECTURE.md — компонентные границы, data flow, build order
- PITFALLS.md — domain-specific и generic pitfalls с mitigation

### Secondary (MEDIUM confidence)
- CLAUDE.md проекта — монорепы Turborepo + pnpm, PostgreSQL + Prisma
- Версии пакетов из package.json: Express 4.21.2, Prisma 7.5.0, Next.js 15.4.2, React 19

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
