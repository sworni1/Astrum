---
phase: 01-prisma-schema-core-crud
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/Astrum-db/prisma/schema.prisma
  - apps/api-astrum/src/modules/reviews/dto/create-review.dto.ts
  - apps/api-astrum/src/modules/reviews/dto/review-query.dto.ts
  - apps/api-astrum/src/modules/reviews/reviews.service.ts
  - apps/api-astrum/src/modules/reviews/reviews.controller.ts
  - apps/api-astrum/src/modules/reviews/reviews.routes.ts
  - apps/api-astrum/src/app.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "Можно создать отзыв для товара, если есть DELIVERED OrderItem"
    - "Созданный отзыв получает статус PENDING"
    - "GET /products/:id/reviews возвращает только APPROVED отзывы с агрегатами"
    - "Один OrderItem = один отзыв (UNIQUE constraint)"
    - "Курсорная пагинация ?limit=20&after=cursor работает по createdAt DESC"
  artifacts:
    - path: "packages/Astrum-db/prisma/schema.prisma"
      provides: "Review, ReviewResponse модели + ReviewStatus enum + Product aggregates"
      contains: "model Review"
    - path: "apps/api-astrum/src/modules/reviews/reviews.service.ts"
      provides: "createReview, getReviewsForProduct, getReviewById методы"
      exports: ["ReviewsService"]
    - path: "apps/api-astrum/src/modules/reviews/reviews.controller.ts"
      provides: "Express controller с тремя route handler методами"
      exports: ["ReviewsController"]
    - path: "apps/api-astrum/src/modules/reviews/reviews.routes.ts"
      provides: "Express Router с зарегистрированными маршрутами"
      exports: ["reviewsRoutes", "productReviewsRouter"]
  key_links:
    - from: "apps/api-astrum/src/modules/reviews/reviews.service.ts"
      to: "packages/Astrum-db/prisma/schema.prisma"
      via: "prisma.review.create/findMany"
      pattern: "prisma\\.(review|orderItem)\\.(create|findFirst|findMany)"
    - from: "apps/api-astrum/src/modules/reviews/reviews.routes.ts"
      to: "apps/api-astrum/src/app.ts"
      via: "app.use() mount"
      pattern: "app\\.use.*reviews"
    - from: "apps/api-astrum/src/modules/reviews/reviews.controller.ts"
      to: "apps/api-astrum/src/modules/reviews/reviews.service.ts"
      via: "instantiated service calling methods"
      pattern: "reviewsService\\.(createReview|getReviewsForProduct|getReviewById)"
---

<objective>
Добавить модели Review/ReviewResponse в Prisma, модуль reviews с CRUD эндпоинтами (POST создание с проверкой покупки, GET курсорная пагинация с агрегатами, GET по ID), зарегистрировать nested маршруты /products/:id/reviews в Express.

Purpose: Фаза-фундамент — без схемы и базовых эндпоинтов ничего остального не работает. Нулевые зависимости.
Output: обновлённая схема Prisma, модуль reviews (5 файлов), маршруты подключены в app.ts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/01-prisma-schema-core-crud/01-CONTEXT.md
@packages/Astrum-db/prisma/schema.prisma

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From apps/api-astrum/src/middlewares/validateDto.ts:
```typescript
// validateDto(CreateReviewDto) — middleware, validates req.body via class-validator
export const validateDto = (dtoClass: any) => async (req, res, next) => {...}
// On error: res.status(400).json({ errors: [...] })
// On success: req.body = dtoInstance; next()
```

From apps/api-astrum/src/modules/order/order.routes.ts (route pattern):
```typescript
orderRoutes.post("/", authenticateToken, validateDto(CreateOrderDto), orderController.createOrder);
```

From apps/api-astrum/src/modules/product/product.service.ts (cursor pagination):
```typescript
const items = await prisma.X.findMany({ take: limit, skip: cursor ? 1 : 0, cursor: cursor ? { id: cursor } : undefined });
let nextCursor = null;
if (items.length === limit) nextCursor = items[items.length - 1].id;
return { items, nextCursor, hasNextPage: !!nextCursor };
```

From apps/api-astrum/src/modules/order/dto/create-order.dto.ts (DTO pattern):
```typescript
import { Expose } from 'class-transformer';
import { IsString, IsNotEmpty } from 'class-validator';

class OrderItemDto {
  @Expose() @IsNotEmpty() @IsString() productId!: string;
}
```

From apps/api-astrum/src/common/helpers/errorHandler.ts:
```typescript
handleErrors(res, err) // maps thrown Errors to HTTP responses
```

Prisma client import: `import { prisma } from '../../../lib/prisma';`
Prisma enums import: `import { SomeEnum } from '../../../generated/prisma/enums';`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Prisma schema — Review, ReviewResponse модели + Product агрегаты</name>
  <files>packages/Astrum-db/prisma/schema.prisma</files>
  <action>
Обновить packages/Astrum-db/prisma/schema.prisma — добавить enum, две новые модели, модифицировать Product и OrderItem.

1. Добавить enum ReviewStatus (после существующих enum-ов):
```prisma
enum ReviewStatus {
  PENDING
  APPROVED
  REJECTED
}
```

2. Добавить модель Review:
```prisma
model Review {
  id               String        @id @default(uuid())
  userId           String
  productId        String
  orderItemId      String        @unique
  rating           Int           @db.SmallInt
  qualityRating    Int           @db.SmallInt
  deliveryRating   Int           @db.SmallInt
  accuracyRating   Int           @db.SmallInt
  comment          String
  photos           String[]      @default([])
  status           ReviewStatus  @default(PENDING)
  createdAt        DateTime      @default(now())
  updatedAt        DateTime      @updatedAt

  Product          Product       @relation(fields: [productId], references: [id])
  OrderItem        OrderItem     @relation(fields: [orderItemId], references: [id])

  @@index([productId, status])
  @@index([userId])
  @@index([createdAt])
}
```

3. Добавить модель ReviewResponse:
```prisma
model ReviewResponse {
  id         String   @id @default(uuid())
  reviewId   String
  businessId String
  comment    String
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([reviewId])
}
```

4. Обновить модель Product — добавить поля:
- `reviewCount    Int    @default(0)`
- `averageRating  Float  @default(0)`
- `reviews        Review[]` (обратная relation)

5. Обновить модель OrderItem — добавить:
- `review  Review?` (обратная relation, один к одному)

6. Обновить модель User (если ещё нет relation):
- `reviews  Review[]` (обратная relation)

7. Применить схему к dev-базе:
   `cd packages/Astrum-db && npx prisma generate && npx prisma db push`

Решения по CONTEXT.md:
- D-01: photos String[] опционально (пустой массив по умолчанию)
- D-02: status ReviewStatus @default(PENDING) напрямую в модели
- D-03: qualityRating, deliveryRating, accuracyRating — три Int колонки
- D-04: rating Int — общий рейтинг 1-5
- D-05: orderItemId обязательное, FK к OrderItem
- D-07: @unique на orderItemId — ровно 1 отзыв на OrderItem
- D-10: reviewCount + averageRating на Product
- D-12: БЕЗ ratingDistribution кэша (отложено)
  </action>
  <verify>
    <automated>cd packages/Astrum-db && npx prisma validate</automated>
    <automated>cd packages/Astrum-db && npx prisma generate</automated>
    <automated>cd packages/Astrum-db && npx prisma db push --accept-data-loss --skip-generate</automated>
  </verify>
  <done>schema.prisma проходит валидацию, Prisma-клиент сгенерирован с Review и ReviewResponse моделями, схема применена к базе через db push.</done>
</task>

<task type="auto">
  <name>Task 2: DTOs + Reviews Service — валидация, проверка покупки, курсорная пагинация</name>
  <files>
apps/api-astrum/src/modules/reviews/dto/create-review.dto.ts
apps/api-astrum/src/modules/reviews/dto/review-query.dto.ts
apps/api-astrum/src/modules/reviews/reviews.service.ts
  </files>
  <action>
Создать 3 файла: два DTO и сервис — следуя паттернам order.product.

**1. dto/create-review.dto.ts** — follow pattern from create-product.dto.ts (per D-16, D-17):
```typescript
import { IsString, IsNotEmpty, IsInt, IsArray, IsUrl, IsOptional, MinLength, Min, Max, Expose } from '...';

export class CreateReviewDto {
  @Expose() @IsString() @IsNotEmpty() productId!: string;

  @Expose() @IsString() @IsNotEmpty() orderItemId!: string;

  @Expose() @IsInt() @Min(1) @Max(5) rating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) qualityRating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) deliveryRating!: number;

  @Expose() @IsInt() @Min(1) @Max(5) accuracyRating!: number;

  @Expose() @IsString() @IsNotEmpty() @MinLength(5) comment!: string;

  @Expose() @IsOptional() @IsArray() @IsUrl({}, { each: true }) photos?: string[];
}
```

**2. dto/review-query.dto.ts** — cursor pagination query params (per D-8, D-9):
```typescript
import { IsString, IsInt, IsOptional, Min, Transform, Expose } from '...';

export class ReviewQueryDto {
  @Expose() @IsOptional() @IsString() after?: string;

  @Expose() @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}
```

**3. reviews.service.ts** — ReviewsService class с тремя публичными методами:

**createReview(userId, productId, dto):**
- Проверить что OrderItem существует: `prisma.orderItem.findUnique({ where: { id: dto.orderItemId } })` — 404 если не найден
- Проверить покупку (D-06 sync validation): `prisma.orderItem.findFirst({ where: { id: dto.orderItemId, userId, productId, status: 'DELIVERED' } })` — бросить Error с '403: Review can only be created for delivered purchases' если не совпадает
- Проверить уникальность (D-07): `prisma.review.findUnique({ where: { orderItemId: dto.orderItemId } })` — бросить Error с '409: Review already exists for this order item' если уже есть
- Создать (D-15 status PENDING): `prisma.review.create({ data: { ... } })`
- Вернуть созданный review

**getReviewsForProduct(productId, { after, limit }):**
- Курсорная пагинация D-8 (точно по паттерну product.service.ts:53-102):
  ```typescript
  const reviews = await prisma.review.findMany({
    where: { productId, status: 'APPROVED' },  // D-14: только APPROVED
    take: query.limit || 20,
    skip: query.after ? 1 : 0,
    cursor: query.after ? { id: query.after } : undefined,
    orderBy: { createdAt: 'desc' },
    include: { OrderItem: { select: { name: true, previewImage: true } } },
  });
  ```
- nextCursor: if reviews.length === limit → reviews[reviews.length - 1].id
- Aggregate summary (D-14):
  ```typescript
  const aggregate = await prisma.review.aggregate({
    where: { productId, status: 'APPROVED' },
    _count: { id: true },
    _avg: { rating: true },
  });
  ```
- Вернуть: `{ reviews, nextCursor, hasNextPage: !!nextCursor, aggregate: { total, averageRating } }`

**getReviewById(reviewId):**
- `prisma.review.findUnique({ where: { id: reviewId } })` — 404 если не найден
- Вернуть review

**updateProductAggregates(productId):** — внутренний метод (вызывается при модерации, D-11):
- Через $transaction:
  ```typescript
  await prisma.$transaction(async (tx) => {
    const aggregate = await tx.review.aggregate({
      where: { productId, status: 'APPROVED' },
      _count: { id: true },
      _avg: { rating: true },
    });
    await tx.product.update({
      where: { id: productId },
      data: {
        reviewCount: aggregate._count.id || 0,
        averageRating: aggregate._avg.rating || 0,
      },
    });
  });
  ```
  Note: Этот метод вызывается при approve/reject отзыва (Phase 3 moderation), но сервисная функция должна быть готова.

Импорты: `import { prisma } from '../../../lib/prisma';`, `import { StatusCodes } from 'http-status-codes';`
  </action>
  <verify>
    <automated>npx tsc --noEmit --project apps/api-astrum/tsconfig.json</automated>
  </verify>
  <done>Все 3 файла компилируются без TypeScript ошибок. createReview отклоняет запрос без DELIVERED OrderItem. getReviewsForProduct возвращает только APPROVED отзывы с курсор-пагинацией и агрегатами.</done>
</task>

<task type="auto">
  <name>Task 3: Reviews Controller + Route Registration</name>
  <files>
apps/api-astrum/src/modules/reviews/reviews.controller.ts
apps/api-astrum/src/modules/reviews/reviews.routes.ts
apps/api-astrum/src/app.ts
  </files>
  <action>
Создать controller, routes и подключить маршруты в Express.

**1. reviews.controller.ts** — class ReviewsController:

```typescript
import { Request, Response } from 'express';
import { ReviewsService } from './reviews.service';
import { StatusCodes } from 'http-status-codes';
import { handleErrors } from '../../common/helpers/errorHandler';
```

Три handler-метода (каждый в try/catch с handleErrors):

- **createReview(req, res):**
  ```typescript
  const productId = req.params['id'] as string;  // из nested /products/:id/reviews
  const userId = (req as any).userId;
  const dto = req.body;
  const review = await this.reviewsService.createReview(userId, productId, dto);
  res.status(StatusCodes.CREATED).json(review);
  ```

- **getProductReviews(req, res):**
  ```typescript
  const productId = req.params['id'] as string;
  const { after, limit } = req.query;
  const result = await this.reviewsService.getReviewsForProduct(productId, { after: after as string, limit: limit ? Number(limit) : undefined });
  res.status(StatusCodes.OK).json(result);
  ```

- **getReviewById(req, res):**
  ```typescript
  const reviewId = req.params['reviewId'] as string;
  const review = await this.reviewsService.getReviewById(reviewId);
  res.status(StatusCodes.OK).json(review);
  ```

**2. reviews.routes.ts** — два отдельных роутера (чистый подход):

```typescript
import { Router } from 'express';
import { validateDto } from '../../middlewares/validateDto';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsController } from './reviews.controller';
import authenticateToken from '../../middlewares/authenticateToken';

const reviewsController = new ReviewsController();

// productReviewsRouter — монтируется как /products/:id/reviews/*
export const productReviewsRouter = Router();
productReviewsRouter.get('/', reviewsController.getProductReviews);
productReviewsRouter.post(
  '/',
  authenticateToken,
  validateDto(CreateReviewDto),
  reviewsController.createReview,
);

// reviewsRouter — монтируется как /reviews/*
export const reviewsRouter = Router();
reviewsRouter.get('/:reviewId', reviewsController.getReviewById);
```

**3. app.ts** — подключить маршруты:
- Найти где в app.ts регистрируются текущие роуты (productRoutes, orderRoutes)
- Добавить:
  ```typescript
  import { productReviewsRouter, reviewsRouter } from './modules/reviews/reviews.routes';
  ...
  app.use('/products/:id/reviews', productReviewsRouter);
  app.use('/reviews', reviewsRouter);
  ```

Путь /products/:id/reviews обеспечивает nested-маршруты (D-13), /reviews/:reviewId — отдельный endpoint для получения отзыва по ID.
  </action>
  <verify>
    <automated>npx tsc --noEmit --project apps/api-astrum/tsconfig.json</automated>
  </verify>
  <done>Три эндпоинта доступны: POST /products/:id/reviews (auth + validate, status 201), GET /products/:id/reviews (status 200 с aggregate), GET /reviews/:reviewId (status 200). Маршруты зарегистрированы в app.ts. Controller следует паттерну product.controller.ts: try/catch, handleErrors, StatusCodes.</done>
</task>

</tasks>

<verification>
1. `cd packages/Astrum-db && npx prisma validate` — схема валидна без ошибок
2. `cd packages/Astrum-db && npx prisma db push` — схема применена к базе
3. `npx tsc --noEmit --project apps/api-astrum/tsconfig.json` — все 5 новых файлов компилируются
4. POST /products/:id/reviews с валидным телом и DELIVERED OrderItem возвращает 201 с PENDING review
5. POST /products/:id/reviews без DELIVERED OrderItem возвращает 403
6. POST /products/:id/reviews с дублирующим orderItemId возвращает 409
7. GET /products/:id/reviews возвращает только APPROVED отзывы + aggregate (total, averageRating) + курсор-пагинацию
8. GET /reviews/:reviewId возвращает отзыв по ID
</verification>

<success_criteria>
- [ ] Все 7 файлов созданы/модифицированы без ошибок компиляции
- [ ] Prisma schema валидна, Review/ReviewResponse модели существуют
- [ ] Product имеет reviewCount и averageRating колонки
- [ ] @unique на Review.orderItemId предотвращает дублирование
- [ ] Все класс-validator DTO-декораторы (@Expose, @IsNotEmpty, @IsInt, @Min, @Max) на месте
- [ ] Курсорная пагинация: skip: cursor ? 1 : 0, take: limit, orderBy createdAt desc
- [ ] Aggregate по APPROVED review: count + avg rating
- [ ] Решения D-01 — D-17 все покрыты:
  - D-01: photos String[] optional
  - D-02: status field в Review
  - D-03: quality/delivery/accuracy — 3 Int колонки
  - D-04: rating Int 1-5
  - D-05: orderItemId обязательное, FK
  - D-06: 403 если нет DELIVERED OrderItem
  - D-07: @unique на orderItemId
  - D-08: ?limit=20&after=cursor пагинация
  - D-09: createdAt DESC
  - D-10: reviewCount + averageRating на Product
  - D-11: updateAggregates через $transaction
  - D-12: БЕЗ ratingDistribution
  - D-13: /products/:id/reviews nested
  - D-14: GET = только APPROVED + aggregate
  - D-15: POST = status PENDING
  - D-16: class-validator DTO
  - D-17: ReviewDTO fields complete
</success_criteria>

<output>
After completion, create `.planning/phases/01-prisma-schema-core-crud/01-prisma-schema-core-crud-01-SUMMARY.md`
</output>
