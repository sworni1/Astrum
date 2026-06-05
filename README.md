## Astrum

Монорепозиторий с фронтендом и бэкендом на базе Turborepo + pnpm workspaces.

### Структура

- **Frontend (customer)**: `apps/customer` — см. `apps/customer/README.md`
- **Backend API (api-astrum)**: `apps/api-astrum` — см. `apps/api-astrum/README.md`
- **Auth service (auth-astrum)**: `apps/auth-astrum` — см. `apps/auth-astrum/README.md`
- **Тональность отзывов (Python, FastAPI)**: `apps/sentiment-astrum` — см. `apps/sentiment-astrum/README.md`
- **Database / Prisma**: `packages/Astrum-db`
- **Прочие общие пакеты**: `packages/*`

### Требования

- Node.js (рекомендуется LTS)
- pnpm (см. версию в `package.json`, поле `packageManager`)
- Docker и Docker Compose (для локальной БД и инфраструктуры)

### Установка и быстрый старт

Все команды выполняются из корня монорепозитория.

1. **Установка зависимостей**

```bash
pnpm install
```

2. **База данных и Prisma (dev)**

```bash
# поднять контейнер с БД
pnpm db:up

# применить миграции (dev)
pnpm prisma:migrate:dev
```

3. **Запуск в режиме разработки**

```bash
# запустить все основные приложения через Turborepo
pnpm dev

# либо по отдельности
pnpm dev:customer
pnpm dev:api
pnpm dev:auth
pnpm dev:business
```

### Примеры запросов

---

## ✅ Положительные

**Review 1**
> Bought these three weeks ago and haven't touched my old pair since. Sound is clear across the range, bass doesn't bleed into mids, and the fit stays put during runs. Battery lasts me two full days on a charge. Worth every cent.

**Перевод:** Купил три недели назад и с тех пор не прикасался к старым наушникам. Звук чистый на всём диапазоне, бас не перекрывает средние частоты, во время пробежки не слетают. Заряда хватает на два полных дня. Деньги потрачены не зря.

---

**Review 2**
> Called customer support about a crackling issue in the left ear. They shipped a replacement the next morning, no questions. The new pair has been perfect for four months. That kind of service earns repeat customers.

**Перевод:** Написал в поддержку из-за треска в левом ухе. На следующее утро прислали замену, без лишних вопросов. Новые наушники работают идеально уже четыре месяца. Такой сервис возвращает клиентов.

---

**Review 3**
> Noise cancellation actually works. On a packed commuter train I can hold a call without raising my voice. Mic picks up cleanly, callers stop asking me to repeat myself. Compact case fits in a jacket pocket.

**Перевод:** Шумоподавление реально работает. В переполненной электричке я веду звонок, не повышая голос. Микрофон пишет чисто, собеседники перестали переспрашивать. Кейс компактный, влезает в карман куртки.

---

## ❌ Отрицательные

**Review 1**
> Pairing breaks every time I switch between my phone and laptop. I have to forget the device and reconnect from scratch. Happens daily. Firmware update didn't fix it. Returning after two weeks.

**Перевод:** Соединение рвётся каждый раз, когда переключаюсь между телефоном и ноутбуком. Приходится удалять устройство и подключать заново. Каждый день. Обновление прошивки не помогло. Возвращаю через две недели.

---

**Review 2**
> Headband cracked at the hinge after three months of normal use. I store them in the case, never drop them. The plastic feels like it was designed to fail just outside the 90-day return window. Paid premium price for budget build quality.

**Перевод:** Оголовье треснуло в шарнире через три месяца обычного использования. Я храню их в кейсе, не роняю. Пластик ощущается так, будто его специально сделали ломаться сразу после окна возврата. Заплатил как за премиум, получил дешёвую сборку.

---

**Review 3**
> Touch controls are too sensitive. Adjusting fit triggers skip, pause, volume change all at once. I disabled them in the app, but then I lose all control while the phone is in my bag. Pick your inconvenience.

**Перевод:** Сенсорное управление слишком чувствительное. При поправлении наушников срабатывает пропуск трека, пауза и громкость одновременно. Отключил в приложении, но тогда теряю управление, пока телефон в сумке. Выбирай неудобство.

### Скрипты (корень репозитория)

Основные скрипты из корневого `package.json`:

- **Разработка**
  - **`pnpm dev`**: общий dev‑режим через Turborepo.
  - **`pnpm dev:customer`**: dev только для `apps/customer`.
  - **`pnpm dev:api`**: dev только для `apps/api-astrum`.
  - **`pnpm dev:auth`**: dev только для `apps/auth-astrum`.
  - **`pnpm dev:business`**: dev только для `apps/business`.

- **Сборка и проверка**
  - **`pnpm build`**: сборка всех приложений/пакетов через Turborepo.
  - **`pnpm lint`**: запуск линтеров во всех пакетах.
  - **`pnpm check-types`**: проверка типов во всех пакетах.

- **Prisma / БД (пакет `packages/Astrum-db`)**
  - **`pnpm db:generate`**: генерация клиента БД (использует `@astrum/db`).
  - **`pnpm prisma:generate`**: `prisma generate` для `packages/Astrum-db`.
  - **`pnpm prisma:migrate:dev`**: `prisma migrate dev` (dev‑миграции).
  - **`pnpm prisma:migrate:deploy`**: `prisma migrate deploy` (prod‑миграции).
  - **`pnpm prisma:studio`**: запуск Prisma Studio.
  - **`pnpm prisma:seed`**: сидинг данных.

- **Docker / инфраструктура**
  - **`pnpm db:up`**: поднять контейнер `astrum-db` в Docker.
  - **`pnpm db:rm`**: удалить контейнер `astrum-db` с томами.
  - **`pnpm db:restart`**: пересоздать БД и применить миграции (`db:rm` → `db:up` → `prisma:migrate:deploy`).
  - **`pnpm docker:up`**: поднять все сервисы из `docker-compose`.
  - **`pnpm docker:down`**: остановить и удалить все сервисы из `docker-compose`.

Отдельные приложения (`apps/*`) могут иметь свои специфические скрипты (Next.js, NestJS и т.д.) — подробности см. в `package.json` соответствующего приложения. Как правило, dev‑запуск удобнее делать через корневые Turborepo‑скрипты, описанные выше.

### Database / Prisma

- Основная схема Prisma и конфигурация БД находятся в пакете `packages/Astrum-db`.
- Файл схемы: `packages/Astrum-db/prisma/schema.prisma`.
- Конфигурация Prisma: `packages/Astrum-db/prisma.config.ts`.
- Для работы с БД используются корневые скрипты `pnpm db:*` и `pnpm prisma:*` (см. выше).

### Переменные окружения

Бэкенд и сервисы аутентификации используют файлы:

- **`.env`** для dev
- **`.env.prod`** для prod

Расположение основных `.env`:

- `apps/api-astrum/.env`, `apps/api-astrum/.env.prod` — пример: `apps/api-astrum/.env.example` (в т.ч. `SENTIMENT_SERVICE_URL` для сервиса тональности)
- `apps/auth-astrum/.env`, `apps/auth-astrum/.env.prod`
- `packages/Astrum-db/.env` (PostgreSQL‑переменные + `DATABASE_URL`)
- `apps/sentiment-astrum/.env` — опционально, см. `apps/sentiment-astrum/.env.example`

`DATABASE_URL` и связанные переменные для БД должны соответствовать значениям, которые использует пакет `packages/Astrum-db` (см. `packages/Astrum-db/prisma.config.ts` и `.env` в этом пакете).
