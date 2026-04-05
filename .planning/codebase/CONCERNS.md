# Codebase Concerns

**Analysis Date:** 2026-04-05

## Tech Debt

**Три копии Prisma-схемы и сгенерированных клиентов:**

- Issue: каноническая схема и миграции живут в `packages/Astrum-db/prisma/schema.prisma`, при этом `apps/api-astrum/prisma/schema.prisma` и `apps/auth-astrum/prisma/schema.prisma` — отдельные копии. Уже есть расхождение: в `packages/Astrum-db/prisma/schema.prisma` у модели `User` есть связь `reviews Review[]`, в копиях под `apps/*` в показанном фрагменте `User` без поля `reviews`. Любое изменение схемы в одном месте без зеркалирования в остальных ломает сборку, типы или рантайм-запросы.
- Files: `packages/Astrum-db/prisma/schema.prisma`, `apps/api-astrum/prisma/schema.prisma`, `apps/auth-astrum/prisma/schema.prisma`, `apps/api-astrum/lib/prisma.ts`, `apps/auth-astrum/src/prisma/prisma.service.ts`
- Impact: скрытые баги после миграций, дублирование `prisma generate`, путаница при онбординге.
- Fix approach: одна схема в `@astrum/db`, импорт клиента из пакета во все приложения; удалить дубликаты или автоматизировать копирование (CI-проверка diff).

**Повторяющийся анти-паттерн `(req as any).userId` в Express:**

- Issue: контроллеры и middleware не типизируют расширенный `Request`; `userId` пробрасывается через приведение к `any`.
- Files: `apps/api-astrum/src/middlewares/authenticateToken.ts`, `apps/api-astrum/src/modules/user/user.controller.ts`, `apps/api-astrum/src/modules/product/product.controller.ts`, `apps/api-astrum/src/modules/cart/cart.controller.ts`, `apps/api-astrum/src/modules/order/order.controller.ts`, `apps/api-astrum/src/modules/wishlist/wishlist.controller.ts`, `apps/api-astrum/src/modules/reviews/reviews.controller.ts`
- Impact: отсутствие проверки типов при рефакторинге, риск опечаток в имени поля.
- Fix approach: объявить модульное расширение `Express.Request` (например `userId?: string`) или общий тип `AuthenticatedRequest`.

**Обход типов в сервисах и валидации:**

- Issue: `product as any` при разборе ответа Prisma; `validateDto(dtoClass: any)`; параметры middleware `req: any, res: any, next: any`; `handleErrors` принимает `err: any`.
- Files: `apps/api-astrum/src/modules/product/product.service.ts`, `apps/api-astrum/src/middlewares/validateDto.ts`, `apps/api-astrum/src/middlewares/authenticateToken.ts`, `apps/api-astrum/src/common/helpers/errorHandler.ts`
- Impact: ослабление гарантий TypeScript, сложнее отлавливать регрессии.
- Fix approach: сузить типы через Prisma `select` + вывод типа; DTO через `new (...args: any[]) => object` или generics; типизированный error handler.

**Скрипт `mcp:check` указывает на удалённый файл:**

- Issue: корневой `package.json` содержит `"mcp:check": "pwsh ./scripts/mcp-health-check.ps1"`, тогда как `scripts/mcp-health-check.ps1` в репозитории отсутствует (удалён).
- Files: `package.json`
- Impact: сломанная команда для операторов/CI.
- Fix approach: восстановить скрипт или удалить/заменить npm-скрипт.

**Устаревший скрипт `dev:business`:**

- Issue: `"dev:business": "turbo dev --filter=@astrum/business"` — пакета `@astrum/business` в workspace нет.
- Files: `package.json`
- Impact: путаница, ошибка при запуске.
- Fix approach: удалить скрипт или добавить пакет.

**Дублирование UI-логики «добавить в корзину с количеством»:**

- Issue: две реализации с похожим поведением и предупреждениями (`console.warn` при лимите количества): `apps/customer/src/features/general/ProductCard/actions/AddToCartWithQuantity/index.tsx` и `apps/customer/src/features/pages/Cart/components/CartCard/actions/AddToCartWithQuantity/index.tsx`.
- Impact: расхождение поведения при правках только в одном месте.
- Fix approach: вынести общий компонент/хук в `apps/customer/src/...` и переиспользовать.

**TODO в UI:**

- Issue: скидка на карточке товара не отображается.
- Files: `apps/customer/src/features/general/ProductCard/index.tsx` (закомментированный `discount` и комментарий TODO)
- Impact: неполный UX относительно доменной модели.
- Fix approach: подключить поле скидки из API и отрисовать.

## Known Bugs

**Fallback при ошибке загрузки изображения на странице заказа:**

- Symptoms: при `onError` у `Image` подставляется строка HTML с тегом `<Package class="...">`, что не является валидной разметкой для иконки Lucide в React и не эквивалентно компоненту `Package`.
- Files: `apps/customer/src/features/pages/Orders/OrderPage/index.tsx`
- Trigger: битый URL превью товара в строке заказа.
- Workaround: визуально может отображаться пустой/сломанный блок вместо иконки.
- Fix approach: не использовать `innerHTML` для иконки; переключать state React и рендерить `<Package />` или статический placeholder.

## Security Considerations

**Отсутствие rate limiting на HTTP API:**

- Risk: злоупотребление логином, перебор, DoS по тяжёлым эндпоинтам.
- Files: `apps/api-astrum/src/app.ts` (нет middleware ограничения частоты)
- Current mitigation: не обнаружено.
- Recommendations: express-rate-limit или edge-ограничение перед API; отдельные лимиты для `/api/auth` (прокси).

**CORS зафиксирован на локальной разработке:**

- Risk: в продакшене с другим origin запросы с браузера будут отклонены, если не обновить конфиг.
- Files: `apps/api-astrum/src/middlewares/corsOptions.ts` (`origin: ["http://localhost:3000"]`)
- Current mitigation: явная белая книга origin (нужно расширять под стенды).
- Recommendations: вынести список origin в переменные окружения; не коммитить прод-домены в код без политики.

**Прокси на auth-сервис без видимой фильтрации путей:**

- Risk: `http-proxy-middleware` к `AUTH_SERVICE_URL` для префикса `/api/auth` — убедиться, что на стороне auth не открыты лишние маршруты; зависит от конфигурации Nest.
- Files: `apps/api-astrum/src/common/helpers/proxyOptions.ts`, `apps/api-astrum/src/app.ts`
- Current mitigation: `changeOrigin: true` только.
- Recommendations: явный `pathFilter`, таймауты прокси, лимит размера тела для проксируемых запросов.

**Helmet используется частично:**

- Risk: включён только `helmet.crossOriginResourcePolicy`; остальные заголовки безопасности по умолчанию из `helmet()` не применены.
- Files: `apps/api-astrum/src/app.ts`
- Recommendations: оценить полный `helmet()` или явный набор для API.

**Тело запроса до 10 MB:**

- Risk: злоупотребление памятью при больших JSON.
- Files: `apps/api-astrum/src/app.ts` (`express.json({ limit: '10mb' })`, `urlencoded` с тем же лимитом и `parameterLimit: 10000`)
- Recommendations: снизить лимит для обычных JSON-эндпоинтов; отдельный маршрут для загрузки файлов при необходимости.

**Секреты и окружение:**

- Risk: `JWT_SECRET` должен совпадать между `apps/customer` (jose), `apps/api-astrum` (jsonwebtoken) и auth; утечка или рассинхрон даёт массовый отказ авторизации.
- Files: `apps/customer/src/common/helpers/session.ts`, `apps/api-astrum/src/middlewares/authenticateToken.ts`
- Recommendations: централизованное управление секретами; не логировать токены (проверить отсутствие логов ответов с cookie).

**Отладочные логи с потенциально чувствительными данными:**

- Risk: `console.log` ответов/заказов в клиенте в продакшене.
- Files: `apps/customer/src/hooks/auth/useAuth.ts`, `apps/customer/src/features/pages/Orders/OrderPage/index.tsx`, `apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx`
- Recommendations: убрать или обернуть в флаг `NODE_ENV === 'development'`.

## Performance Bottlenecks

**Лимиты парсера тела и параметров:**

- Problem: очень высокий `parameterLimit` (10000) у `urlencoded` увеличивает поверхность атаки и нагрузку на парсер.
- Files: `apps/api-astrum/src/app.ts`
- Cause: широкие лимиты «на всякий случай».
- Improvement path: согласовать с реальными формами; держать минимально достаточные значения.

**Отсутствие кэширования на уровне API:**

- Problem: списки товаров и детали без упоминания HTTP-кэша в просмотренных файлах.
- Files: слой `apps/api-astrum` (общая оценка по отсутствию cache-control middleware в `app.ts`)
- Improvement path: ETag/Cache-Control для публичных GET, CDN для статики в Next.

## Fragile Areas

**Сессия и cookie `secure: true`:**

- Files: `apps/customer/src/common/helpers/session.ts`
- Why fragile: на локальном HTTP без TLS cookie с `secure: true` может не отправляться браузером — зависит от сценария разработки.
- Safe modification: для dev использовать `secure: process.env.NODE_ENV === 'production'` или переменную окружения.
- Test coverage: автотестов customer не обнаружено.

**Сидер Excel и парсинг HTML:**

- Files: `packages/Astrum-db/prisma/seedFromExcel.ts` (`regex.exec`, `// @ts-ignore - free xlsx memory`, `as any[]` для bulk create)
- Why fragile: большой скрипт, зависимость от формата Excel и внешних URL; отключение проверок типов.
- Safe modification: запускать только в контролируемом окружении; покрыть дымовыми проверками после изменения схемы.

## Scaling Limits

**Монолитный Express без очередей:**

- Current capacity: синхронная обработка запросов в одном процессе (типичный dev/prod single instance).
- Limit: рост CPU-bound операций (например тяжёлые запросы Prisma) без горизонтального масштабирования и пула воркеров.
- Scaling path: несколько инстансов за балансировщиком, connection pooling к PostgreSQL, вынесение тяжёлых задач в очередь.

## Dependencies at Risk

**`xlsx` в пакете БД:**

- Risk: пакет исторически получал уязвимости; тяжёлый парсинг больших файлов.
- Impact: зависимость только в сидировании, не в рантайме API для пользователей.
- Migration plan: при проблемах — замена на `exceljs` или ограничение размера входных файлов.

## Missing Critical Features

**Единый контракт ошибок API:**

- Problem: `handleErrors` отдаёт `err.message` клиенту при `instanceof Error`, что может раскрывать внутренние детали.
- Blocks: предсказуемый формат ошибок для фронта.
- Files: `apps/api-astrum/src/common/helpers/errorHandler.ts`

## Test Coverage Gaps

**`@astrum/api` (Express):**

- What's not tested: unit- и интеграционные тесты для контроллеров и сервисов отсутствуют (файлов `*.spec.ts` нет).
- Files: весь каталог `apps/api-astrum/src`
- Risk: регрессии в бизнес-логике заказов, корзины, продуктов без автоматической проверки.
- Priority: High

**`@astrum/customer` (Next.js):**

- What's not tested: не найдено тестовых файлов по шаблону в приложении customer.
- Files: `apps/customer/src`
- Risk: поломки маршрутизации, форм, хуков без регресса.
- Priority: High

**`@astrum/auth` (NestJS):**

- What's tested: есть `*.spec.ts` и e2e в `apps/auth-astrum/test/`.
- Files: `apps/auth-astrum/src/auth/auth.service.spec.ts`, `apps/auth-astrum/src/auth/auth.controller.spec.ts`, `apps/auth-astrum/src/prisma/prisma.service.spec.ts`, `apps/auth-astrum/test/app.e2e-spec.ts`, `apps/auth-astrum/test/api-astrum.e2e-spec.ts`
- Gap: покрытие не измерено в этом аудите; интеграция с реальной БД может требовать отдельных контрактных тестов.

---

*Concerns audit: 2026-04-05*
