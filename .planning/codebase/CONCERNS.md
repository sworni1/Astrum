# Concerns and Risks — Astrum

Дата актуализации: 2026-04-04

---

## ВЫСОКИЙ ПРИОРИТЕТ — Может сломаться или привести к утечке

### C-01: GitHub PAT в .env файле, отслеживается git-ом
**Расположение:** `E:/Astrum/Astrum/.env`
**Проблема:** Файл `.env` содержит `GITHUB_PAT=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`. Персональный токен GitHub экспонирован напрямую. Хотя `.env` перечислен в `.gitignore`, сам файл находится в корне репозитория, что создаёт риск случайного коммита или утечки.
**Рекомендация:**
- Немедленно отозвать этот PAT и регенерировать
- Переместить секреты в `.env.local` или менеджер секретов
- Добавить проверку на наличие токенов в pre-commit hook
- Использовать `git secrets` или подобные инструменты для предотвращения коммита секретов

### C-02: Нет rate limiting на API
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/app.ts`
**Проблема:** Ни один эндпоинт API не имеет ограничения частоты запросов (rate limiting). Это критично для публичного API — возможны brute-force атаки, DoS, и злоупотребление эндпоинтами.
**Рекомендация:** Установить `express-rate-limit` и настройте лимиты для каждого роута, особенно для auth, order и create.

### C-03: Оплата не реализована, но доступна в схеме
**Расположение:** `E:/Astrum/Astrum/packages/Astrum-db/prisma/schema.prisma` (enum `PaymentMethod`) и `E:/Astrum/Astrum/apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx`
**Проблема:** В Prisma-схеме и на фронте объявлены методы оплаты `PAYPAL` и `STRIPE`, но SDK для этих провайдеров не установлены. Заказ создаётся без реального списания средств. `paymentDetails` — это просто строка, без валидации.
**Рекомендация:** Либо интегрировать Stripe/PayPal SDK перед запуском, либо временно удалить эти методы оплаты из enum'а и UI.

### C-04: Цены рассчитываются на клиенте
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/order/order.service.ts` строки 16-19 и `E:/Astrum/Astrum/apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx`
**Проблема:** `totalPrice` для заказа рассчитывается на основе `price * quantity` из DTO на сервере, без повторной проверки актуальных цен из БД. Злоумышленник может передать произвольные цены в `orderItems` и создать заказ по любой цене.
**Рекомендация:** При создании заказа загружать актуальные цены продуктов из БД и рассчитывать итоговую сумму самостоятельно.

### C-05: CORS разрешён только для localhost
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/middlewares/corsOptions.ts` и `E:/Astrum/Astrum/apps/auth-astrum/src/main.ts`
**Проблема:** В обоих сервисах CORS настроен только на `http://localhost:3000`. Это заблокирует легитимные запросы при деплое на продакшен. Нет механизма для окружения (dev/prod).
**Рекомендация:** Использовать переменные окружения для списка разрешённых origin'ов, включая продакшен-домены.

### C-06: JWT cookie expires mismatch
**Расположение:** `E:/Astrum/Astrum/apps/customer/src/common/helpers/session.ts` vs `E:/Astrum/Astrum/apps/auth-astrum/src/auth/auth.service.ts`
**Проблема:** JWT токен подписывается со сроком жизни `1d` (Auth service), но cookie устанавливается с `expires` через `7 * 24 * 60 * 60 * 1000` (7 дней). После истечения JWT через 1 день cookie останется, но верификация будет проваливаться, создавая путаное состояние "вроде залогинен, но не авторизуется".
**Рекомендация:** Синхронизировать время жизни JWT и cookie, либо реализовать automatic token refresh.

### C-07: Секреты JWT передаются через env, но нет валидации
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/middlewares/authenticateToken.ts` и `E:/Astrum/Astrum/apps/customer/src/common/helpers/session.ts`
**Проблема:** `process.env.JWT_SECRET` используется без проверки на наличие. В `session.ts` строка 7 — `secretKey` может быть `undefined`, что приведёт к падению при `TextEncoder().encode(undefined)`.
**Рекомендация:** Добавить валидацию required env-переменных на старте (например, через `zod` или `dotenv-validate`).

---

## СРЕДНИЙ ПРИОРИТЕТ — Качество, техдолг, архитектурные риски

### C-08: N+1 запросы в cart и wishlist сервисах
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/cart/cart.service.ts` строки 101-109 (getCart) и строки 24 (addProductToCart)
**Проблема:** При получении корзины (getCart) происходит один запрос для fetch всех продуктов, а затем N дополнительных запросов в `getWishlistAndCartItem` для каждого продукта. Аналогичная проблема в wishlist. Для корзины из 20 товаров — 21 запрос.
**Рекомендация:** Использовать `Promise.all` с одним запросом `whereIn` для wishlistId/cartId, или переписать через Prisma `$queryRaw` с JOIN.

### C-09: Обработка ошибок проглатывает оригинальное сообщение
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/cart/cart.service.ts` и другие сервисы
**Проблема:** Паттерн `throw new Error('addProductToCart error')` повторяется во всех catch-блоках (cart.service.ts строки 42, 78, 116, 131). Оригинальная ошибка и stack trace полностью уничтожаются. Отладка в production будет крайне затруднена.
**Рекомендация:** Использовать кастомные Error классы с сохранением оригинальной ошибки: `throw new CartError('addProductToCart failed', { cause: error })`.

### C-10: Повсеместное использование `any`
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/middlewares/authenticateToken.ts` строка 5, `errorHandler.ts` строка 4, `validateDto.ts` строка 6, все контроллеры — `(req as any).userId`
**Проблема:** `any` используется более 25 раз в api-сервисе, включая Express middleware и контроллеры. Полностью отсутствует типизация request/response.
**Рекомендация:** Определить интерфейсы `AuthenticatedRequest extends Request { userId: string }` и использовать вместо `any`.

### C-11: Отсутствует валидация входных DTO в createProduct
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/product/product.controller.ts` строка 67
**Проблема:** Эндпоинт `createProduct` передаёт `req.body` напрямую в сервис без использования middleware `validateDto`. Любой может создать продукт с произвольными данными.
**Рекомендация:** Добавить `validateDto(CreateProductDto)` в маршрут.

### C-12: getRecommendations вызывает N запросов Wishlist/Cart
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/product/product.service.ts` строки 77-88
**Проблема:** Для каждого продукта (до `limit`, default 8) в `getRecommendations` вызывается `getWishlistAndCartItem` — отдельный запрос к БД. При limit=8 это 16 дополнительных запросов.
**Рекомендация:** Загружать все wishlist и cart items одним запросом с `whereIn` до маппинга.

### C-13: Жёстко закодированные shippingMethods на фронте
**Расположение:** `E:/Astrum/Astrum/apps/customer/src/features/pages/Cart/components/CheckoutForm/index.tsx` строки 48-51
**Проблема:** Методы доставки захардкожены с конкретными ID в фронтенде. Это делает систему негибкой и требует деплоя фронтенда при каждом изменении методов доставки.
**Рекомендация:** Загружать методы доставки из API (эндпоинт `/api/shipping-methods` уже существует в БД через модель ShippingMethod).

### C-14: Отсутствуют API-тесты для Express API
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/`
**Проблема:** У api-astrum нет ни одного теста. Только auth-сервис имеет 3 spec-файла (и те базовые). Покрытие тестами фактически 0%.
**Рекомендация:** Добавить Jest + Supertest для API. Начать с критичных путей: auth, создание заказа, карзина.

### C-15: `dist` и `generated` директории в src-дереве
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/dist/`
**Проблема:** Скомпилированный `dist` и сгенерированный Prisma-клиент `generated` находятся внутри рабочей директории. Хотя они в `.gitignore`, IDE и линтеры будут индексировать эти файлы, что замедляет разработку.
**Рекомендация:** Убедиться, что `tsconfig` правильно исключает `dist` и `generated`. Рассмотреть вынос `generated` в отдельную директорию.

### C-16: createProduct генерирует businessId через randomUUID
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/product/product.service.ts` строка 95
**Проблема:** `businessId` — это не UUID, а, вероятно, бизнес-идентификатор (SKU, артикул). Генерация через `randomUUID()` означает, что businessId бесполезен для поиска/идентификации.
**Рекомендация:** Уточнить назначение businessId. Если это SKU — генерировать осмысленный, если авто-инкремент — использовать Prisma `@default(cuid())` или `@default(dbgenerated())`.

### C-17: Prisma использует Float для денежных значений
**Расположение:** `E:/Astrum/Astrum/packages/Astrum-db/prisma/schema.prisma` (Product.price, Order.totalPrice, OrderItem.price, ShippingMethod.price)
**Проблема:** Float подвержен проблемам округления в денежных операциях. Это может приводить к ошибкам в расчетах.
**Рекомендация:** Использовать `Decimal` тип Prisma для всех денежных значений.

### C-18: Отсутствует логирование ошибок на сервере
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/common/helpers/errorHandler.ts`
**Проблема:** `handleErrors` просто отправляет JSON-ответ. Ошибки не логируются, нет стека вызовов, нет мониторинга (Sentry, Winston и т.п.).
**Рекомендация:** Подключить Winston или pino для структурированного логирования, минимум — логируйте `err.message` и `err.stack` при 500-х ошибках.

### C-19: Duplicate error messages
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/order/order.service.ts` строки 51 и 58
**Проблема:** `throw new Error('getOrderById error')` используется дважды для разных условий (order not found и shipping method not found). Невозможно отличить причины ошибки.
**Рекомендация:** Разные сообщения для разных условий ошибки.

### C-20: Swagger в production
**Расположение:** `E:/Astrum/Astrum/apps/auth-astrum/src/main.ts`
**Проблема:** Swagger UI доступен без ограничений. В production это раскрывает внутреннюю структуру API злоумышленникам.
**Рекомендация:** Отключить Swagger в production или ограничить доступ авторизацией.

---

## НИЗКИЙ ПРИОРИТЕТ — Стиль, согласованность, мелкие улучшения

### C-21: Несогласованные стили валидации между сервисами
**Расположение:** API использует `class-transformer` + `class-validator` через middleware, Auth использует `ValidationPipe` от NestJS, Customer использует `zod`
**Проблема:** Три разные библиотеки для валидации в пределах одного проекта. Это усложняет поддержку и увеличивает bundle size.
**Рекомендация:** Конвергентировать на zod для обоих backend'ов (или class-validator для обоих, что проще в NestJS/Express унификации).

### C-22: Примеры паролей в DTO
**Расположение:** `E:/Astrum/Astrum/apps/auth-astrum/src/auth/dto/dto.user.ts`
**Проблема:** `default: 'qwertyuiop'` в Swagger документации. При генерации доков или тестировании может быть использован как подсказка.
**Рекомендация:** Заменить на `example: '••••••••'` или использовать реалистичный пример.

### C-23: Один TODO во фронтенде
**Расположение:** `E:/Astrum/Astrum/apps/customer/src/features/general/ProductCard/index.tsx` строка 73
**Проблема:** `// TODO: Implement discount display` — не отображается скидка на карточке продукта, хотя модель Product поддерживает поле `discount`.

### C-24: Apollo Client установлен но не используется
**Расположение:** `E:/Astrum/Astrum/apps/customer/package.json` (apollo client в зависимостях)
**Проблема:** Apollo Client установлен, но GraphQL сервер отсутствует. Мёртвая зависимость увеличивает время установки и bundle size.
**Рекомендация:** Удалить неиспользуемые зависимости.

### C-25: Синглтоны сервисов создаются через `new` вместо DI
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/cart/cart.service.ts` строка 14: `private productService = new ProductService()`
**Проблема:** Сервисы создаются вручную через `new` вместо инъекции зависимостей. Это делает тестирование затрудненным и нарушает принцип единственной ответственности.
**Рекомендация:** Использовать DI-контейнер или хотя бы передавать зависимости через конструктор.

### C-26: Отсутствие пагинации для заказов
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/order/order.service.ts` строки 77-81
**Проблема:** `getOrdersByUserId` возвращает все заказы без пагинации. У пользователя с большой историей заказов это вызовет большие задержки.
**Рекомендация:** Добавить курсорную или offset пагинацию.

### C-27: Не используется Prisma relation для Order → ShippingMethod
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/order/order.service.ts` строки 54-57
**Проблема:** ShippingMethod загружается отдельным запросом, хотя Prisma relation настроена. Можно использовать `include: { shippingMethod: true }`.
**Рекомендация:** Убрать отдельный запрос и использовать Prisma include.

### C-28: Нет index на часто используемых полях
**Расположение:** `E:/Astrum/Astrum/packages/Astrum-db/prisma/schema.prisma`
**Проблема:** Отсутствуют индексы на `Order.userId`, `Product.category`, `LastViewedProduct.userId`, `Impression.productId`. При росте базы запросы будут замедляться.
**Рекомендация:** Добавить `@@index` на поля, по которым часто идёт фильтрация или поиск.

### C-29: Product.quantity не обновляется при заказе
**Расположение:** `E:/Astrum/Astrum/apps/api-astrum/src/modules/order/order.service.ts`
**Проблема:** При создании заказа не уменьшается `Product.quantity` и не проверяется, что товар ещё доступен. Возможен oversell.
**Рекомендация:** Использовать транзакцию Prisma для атомарного создания заказа и уменьшения остатков.

---

## Сводная матрица рисков

| # | Краткое описание | Приоритет | Затронутые модули |
|---|---|---|---|
| C-01 | GitHub PAT экспонирован | КРИТИЧЕСКИЙ | .env |
| C-02 | Нет rate limiting | ВЫСОКИЙ | api-astrum |
| C-03 | Оплата не интегрирована | ВЫСОКИЙ | order, checkout |
| C-04 | Цены не валидируются на сервере | ВЫСОКИЙ | order |
| C-05 | CORS только localhost | ВЫСОКИЙ | api, auth |
| C-06 | JWT/cookie срок жизни mismatch | ВЫСОКИЙ | auth, customer |
| C-07 | Нет валидации JWT_SECRET | ВЫСОКИЙ | api, customer |
| C-08 | N+1 запросы в cart | СРЕДНИЙ | cart.service |
| C-09 | Ошибки проглатываются | СРЕДНИЙ | Все сервисы api |
| C-10 | `any` типы повсеместно | СРЕДНИЙ | api-astrum |
| C-11 | Нет валидации createProduct | СРЕДНИЙ | product.controller |
| C-12 | N+1 в recommendations | СРЕДНИЙ | product.service |
| C-13 | Хардкод shipping methods | СРЕДНИЙ | CheckoutForm |
| C-14 | Нет API-тестов | СРЕДНИЙ | api-astrum |
| C-15 | dist/generated в дереве | СРЕДНИЙ | api-astrum |
| C-16 | businessId = random UUID | СРЕДНИЙ | product.service |
| C-17 | Float для денег | СРЕДНИЙ | schema.prisma |
| C-18 | Нет серверного логирования | СРЕДНИЙ | errorHandler |
| C-19 | Дублирующиеся сообщения ошибок | СРЕДНИЙ | order.service |
| C-20 | Swagger в production | СРЕДНИЙ | auth-service |
| C-21 | Три библиотеки валидации | НИЗКИЙ | Все сервисы |
| C-22 | Пример пароля в Swagger | НИЗКИЙ | auth dto |
| C-23 | TODO: discount display | НИЗКИЙ | ProductCard |
| C-24 | Мёртвая зависимость Apollo | НИЗКИЙ | customer |
| C-25 | Сервисы создаются через new | НИЗКИЙ | api-astrum |
| C-26 | Нет пагинации заказов | НИЗКИЙ | order.service |
| C-27 | Не используется Prisma include | НИЗКИЙ | order.service |
| C-28 | Отсутствуют индексы на полях | НИЗКИЙ | schema.prisma |
| C-29 | Oversell — не уменьшается quantity | СРЕДНИЙ | order.service |
