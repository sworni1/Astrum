# Codebase Concerns

**Дата анализа:** 2026-04-07

Ниже перечислены **конкретные риски/проблемы/техдолг** с привязкой к путям, последствиями и **минимальным следующим шагом**.

## 1) Дублирование Prisma-схем и клиентов (риск рассинхронизации модели данных)

- **Проблема:** В репозитории есть **три независимые Prisma-схемы** и, судя по импорту `../generated/prisma/client`, **три независимых Prisma Client**.
  - Схемы:
    - `packages/Astrum-db/prisma/schema.prisma`
    - `apps/api-astrum/prisma/schema.prisma`
    - `apps/auth-astrum/prisma/schema.prisma`
  - Клиенты/инициализация:
    - `packages/Astrum-db/lib/prisma.ts`
    - `apps/api-astrum/lib/prisma.ts`
    - `apps/auth-astrum/src/prisma/prisma.service.ts`
- **Чем чревато:**
  - Незаметный дрейф моделей (поле/enum/индексы) между сервисами → разные ожидания API/валидации/БД.
  - Сложнее управлять миграциями и совместимостью схем при деплое нескольких сервисов.
- **Минимальный следующий шаг:** выбрать **единственный источник истины** для схемы (обычно `packages/Astrum-db/prisma/schema.prisma`) и зафиксировать правило: `apps/*` не содержат своих `schema.prisma`, а импортируют Prisma Client из `@astrum/db` (или наоборот — но единообразно).

## 2) Миграции есть только в `@astrum/db`, но Prisma config в `apps/*` указывает на миграции, которых нет

- **Проблема:** Миграции присутствуют только в `packages/Astrum-db/prisma/migrations/*`, при этом в `apps/api-astrum/prisma.config.ts` и `apps/auth-astrum/prisma.config.ts` настроен путь `prisma/migrations`, но в этих приложениях миграции не обнаружены.
  - Есть миграции: `packages/Astrum-db/prisma/migrations/*`
  - Prisma config с migrations path:
    - `apps/api-astrum/prisma.config.ts`
    - `apps/auth-astrum/prisma.config.ts`
- **Чем чревато:**
  - Разработчик может случайно запускать `prisma migrate` не в том месте/пакете и получить “пустую” миграционную историю.
  - Инструменты/скрипты могут создавать миграции в `apps/*` и окончательно разнести состояние.
- **Минимальный следующий шаг:** удалить/запретить использование `prisma.config.ts` в `apps/*` или сделать их тонкой обёрткой над `@astrum/db` (без собственных migrations), плюс добавить проверку в CI/хуках: “в `apps/*/prisma/migrations` не должно быть файлов”.

## 3) Несостыковка JWT payload между `auth-astrum` и JWT-стратегией (вероятный баг и риск обхода проверок)

- **Проблема:** `auth-astrum` подписывает токен с payload вида `{ userId }`, а `JwtStrategy.validate()` ожидает payload `{ sub, email }`.
  - Подпись токена: `apps/auth-astrum/src/auth/auth.service.ts` (payload содержит `userId`)
  - Проверка токена: `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts` (использует `payload.sub`)
- **Чем чревато:**
  - Валидация может работать некорректно (пользователь не находится, `payload.sub` undefined) → неожиданные 401/500.
  - Если в будущем появятся разные форматы токенов (cookie/Bearer) — легко получить неконсистентную авторизацию.
- **Минимальный следующий шаг:** унифицировать контракт JWT: либо всегда использовать `sub` (и выставлять его при подписи), либо менять стратегию на чтение `payload.userId`. Зафиксировать схему payload отдельным типом (например, в общем пакете) и покрыть тестом.

## 4) Потенциальный 500 из-за `delete user.passwordhash` при `user === null`

- **Проблема:** В `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts` после `findUnique` выполняется `delete user.passwordhash` без проверки на `null`.
- **Чем чревато:** При валидном токене с несуществующим `sub` (или при рассинхроне данных) сервис может падать 500 вместо корректного 401/403.
- **Минимальный следующий шаг:** добавить ранний возврат/исключение при `!user` и покрыть тестом (unit на `JwtStrategy.validate`).

## 5) Дублирование JWT-валидации и разные каналы передачи токена (cookie vs Bearer)

- **Проблема:** `api-astrum` авторизует запросы через cookie `__auth`, а `auth-astrum` настроен на Bearer token в заголовке; при этом фронт кладёт токен в cookie.
  - Cookie-проверка: `apps/api-astrum/src/middlewares/authenticateToken.ts`
  - Bearer extraction: `apps/auth-astrum/src/auth/strategy/jwt.strategy.ts`
  - Установка cookie: `apps/customer/src/common/helpers/session.ts`
- **Чем чревато:**
  - Сложнее обеспечить единые security-параметры (SameSite/CSRF/refresh/logout) и единый формат ошибок.
  - Риск расхождения требований между сервисами (например, один ожидает Bearer, другой — cookie) при интеграциях.
- **Минимальный следующий шаг:** определить единый транспорт токена для “внутренних” API (cookie или Bearer) и задокументировать. Если cookie — добавить защиту от CSRF для state-changing запросов (см. ниже).

## 6) CSRF-риск при cookie-авторизации (особенно для POST/PUT/DELETE)

- **Проблема:** `api-astrum` читает JWT из cookie (`__auth`) и при этом CORS включён с `credentials: true`.
  - Cookie auth: `apps/api-astrum/src/middlewares/authenticateToken.ts`
  - CORS: `apps/api-astrum/src/middlewares/corsOptions.ts`, `apps/api-astrum/src/app.ts`
- **Чем чревато:** Если origin-ограничения будут расширены/ошибочно настроены (или появятся дополнительные домены), возможны CSRF-атаки на защищённые эндпоинты.
- **Минимальный следующий шаг:** добавить CSRF-митигирующий слой (минимум: double submit cookie/CSRF token для небезопасных методов) и/или перейти на Bearer token для state-changing операций.

## 7) Жёстко захардкоженные origin’ы и порты (среда/деплой и безопасность)

- **Проблема:** CORS для `api-astrum` и `auth-astrum` захардкожен на `http://localhost:3000`, порты — в коде.
  - `apps/api-astrum/src/middlewares/corsOptions.ts`
  - `apps/auth-astrum/src/main.ts`
  - `apps/api-astrum/src/server.ts` (порт 3580)
- **Чем чревато:**
  - Непредсказуемый прод: при смене домена/портов сервисы не поднимутся или откроют доступ “не туда”.
  - Риск случайного расширения CORS “вручную” без централизованной политики.
- **Минимальный следующий шаг:** вынести `CORS_ORIGINS`, `PORT` (и аналогичные) в конфиг/ENV (без чтения секретов в коде) и добавить проверку старта: “если переменные не заданы — падать с понятной ошибкой”.

## 8) `AUTH_SERVICE_URL!` с non-null assertion → падение при отсутствии env

- **Проблема:** в `apps/api-astrum/src/app.ts` используется `process.env.AUTH_SERVICE_URL!` без graceful fallback.
- **Чем чревато:** сервис упадёт при старте/первом запросе, если переменная не подхватилась (частая проблема в Docker/CI).
- **Минимальный следующий шаг:** валидировать env при старте (минимум: явная проверка + ошибка с понятным текстом), лучше — централизованная схема env (Zod/класс-конфиг).

## 9) Docker Compose: внешняя сеть `astrumnetwork` (хрупкая инфраструктура)

- **Проблема:** `docker-compose.yml` использует `networks.astrumnetwork.external: true`.
  - `docker-compose.yml`
- **Чем чревато:**
  - На “чистом” окружении `docker compose up` упадёт, пока сеть не создана вручную.
  - В CI/Preview окружениях потребуется отдельный шаг, который легко забыть.
- **Минимальный следующий шаг:** либо убрать `external: true` (пусть compose создаёт сеть сам), либо добавить явный скрипт `pnpm docker:net:create`/документацию в `README.md`, который создаёт сеть перед поднятием.

## 10) Docker Compose: `env_file` указывает на `.env*` файлы (есть риск конфигурационного дрейфа)

- **Проблема:** `docker-compose.yml` подтягивает env из:
  - `packages/Astrum-db/.env`
  - `apps/api-astrum/.env.prod`
  - `apps/auth-astrum/.env.prod`
  - `apps/customer/.env.production`
- **Чем чревато:**
  - Конфиги окружений живут в разных местах и легко расходятся (dev/prod), особенно по `DATABASE_URL`, `JWT_SECRET`, `AUTH_SERVICE_URL`.
  - Высокая вероятность “работает локально, падает в Docker”.
- **Минимальный следующий шаг:** ввести единый подход к env (например, `.env.example` в каждом пакете + проверка “все обязательные env заданы”), а также минимальный smoke-check скрипт, который валидирует набор переменных перед запуском `docker compose up`.

## 11) Разнобой версий Node в Dockerfile’ах (предсказуемость сборки/рантайма)

- **Проблема:** `apps/api-astrum/Dockerfile` и `apps/auth-astrum/Dockerfile` используют `node:18-alpine`, а `apps/customer/Dockerfile` — `node:20-alpine`.
- **Чем чревато:** разные версии V8/Node могут давать разные runtime-ошибки, особенно при сборке Next.js и использовании современных пакетов.
- **Минимальный следующий шаг:** унифицировать версию Node (желательно LTS) по всем Dockerfile’ам и зафиксировать её также в документации/CI.

## 12) Отсутствие явного CI pipeline (линт/типы/тесты/миграции не гарантируются)

- **Проблема:** не обнаружены workflow-файлы в `.github/workflows/`.
- **Чем чревато:** регрессии и сломанные миграции/контракты легко попадают в основную ветку.
- **Минимальный следующий шаг:** добавить минимальный CI: `pnpm install` → `pnpm lint` → `pnpm check-types` → (минимум) `pnpm --filter @astrum/auth test` → (опционально) `pnpm prisma:migrate:deploy --dry-run`/валидация Prisma схемы.

## 13) Тесты: покрытие есть только в `auth-astrum`, у `api-astrum` и `customer` — фактически отсутствует

- **Проблема:** тестовые файлы обнаружены в основном в `apps/auth-astrum/src/**/*.spec.ts` и `apps/auth-astrum/test/*`.
- **Чем чревато:** критичные бизнес-потоки (корзина/заказ/отзывы) в `apps/api-astrum/src/modules/**` меняются без защитной сетки.
- **Минимальный следующий шаг:** добавить хотя бы по 1–2 интеграционных smoke-теста на ключевые маршруты `api-astrum` (например, `/api/users/me`, `/api/cart`, `/api/orders`) с использованием реального `authenticateToken` и тестовой БД/транзакций.

## 14) Корневой скрипт `mcp:check` указывает на удалённый файл (сломанный dev-инструмент)

- **Проблема:** в корневом `package.json` есть `mcp:check`: `pwsh ./scripts/mcp-health-check.ps1`, а в статусе репозитория файл отмечен как удалённый: `scripts/mcp-health-check.ps1`.
  - `package.json` (root)
  - `scripts/mcp-health-check.ps1` (удалён/отсутствует)
- **Чем чревато:** команды разработки ломаются, люди перестают доверять скриптам и обходят проверки.
- **Минимальный следующий шаг:** либо восстановить `scripts/mcp-health-check.ps1`, либо удалить/заменить скрипт на актуальный.

## 15) API Gateway проксирует auth без явных ограничений/таймаутов (операционная хрупкость)

- **Проблема:** прокси к `auth` настроен минимально, без явных таймаутов/обработки ошибок.
  - `apps/api-astrum/src/common/helpers/proxyOptions.ts`
  - `apps/api-astrum/src/app.ts` (маршрут `/api/auth`)
- **Чем чревато:** зависание запросов/ресурсное истощение при деградации auth-сервиса; сложнее наблюдать и дебажить.
- **Минимальный следующий шаг:** добавить таймауты/обработку ошибок в прокси и минимальный лог/метрики на деградации (хотя бы ответы 502/504 с понятным сообщением).

## 16) Мелкий техдолг (маркер будущих проблем)

- **Проблема:** найден TODO в UI.
  - `apps/customer/src/features/general/ProductCard/index.tsx` (TODO по отображению скидки)
- **Чем чревато:** небольшое, но показывает отсутствие “definition of done” и проверки UI-ожиданий тестами/линтом.
- **Минимальный следующий шаг:** закрыть TODO или оформить как issue/таск + добавить минимальный UI-тест/скрин-тест на карточку.

---

*Аудит рисков: 2026-04-07*

