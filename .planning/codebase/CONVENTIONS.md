# Соглашения по коду — Astrum

Обновлено: 2026-04-04

## Именование

| Сущность | Convention | Примеры |
|----------|------------|---------|
| Компоненты React | PascalCase | `ProductCard`, `CheckoutForm`, `OptimizedImage` |
| Hook-и React | camelCase, `use` префикс | `useFetcher`, `useAuth` |
| Переменные/функции | camelCase | `getWishlistAndCart`, `handleRegister` |
| Классы (контроллеры, сервисы) | PascalCase | `ProductController`, `CartService`, `AuthService` |
| DTO классы | PascalCase + суффикс `Dto` | `RegisterUserDto`, `SignInUserDto`, `CreateProductDto` |
| Файлы DTO | kebab-case + `.dto.ts` | `create-product.dto.ts`, `update-user.dto.ts` |
| Типы/интерфейсы TypeScript | PascalCase | `ProductCardProps`, `UserData`, `JwtData`, `SignUpCredentials` |
| Enums | PascalCase | `Gender`, `Currency`, `ProductCategory`, `PropertyLabel` |
| Zod схемы | camelCase + суффикс `Schema`/`Scheme` | `signInFormSchema`, `registerFormSchema` |
| Константы | UPPER_SNAKE_CASE | `StatusCodes`, `ReasonPhrases` |
| Файлы helpers | camelCase | `showToast.tsx`, `getCurrencyEmoji.ts`, `errorHandler.ts` |
| Файлы index | `index.ts`, `index.tsx` | Баррель-экспорты |

## Организация файлов

### Monorepo структура

```
apps/
├── api-astrum/        # Express API (порт 3580)
├── auth-astrum/       # NestJS Auth Service (порт 4580)
└── customer/          # Next.js 15 Frontend (порт 3000)
packages/
└── Astrum-db/         # Prisma (владелец схемы)
```

### API (Express) — модульная структура по доменам

Каждый модуль — отдельная папка в `src/modules/<module>/`:

```
modules/
├── product/
│   ├── product.controller.ts    # Обработчики HTTP
│   ├── product.service.ts       # Бизнес-логика + Prisma
│   ├── product.routes.ts        # Определение роутов
│   └── dto/                     # DTO для этого модуля
│       └── create-product.dto.ts
```

Shared-код: `src/common/helpers/`, `src/common/types/`, `src/common/prisma-selects/`
Middleware: `src/middlewares/`
Entry: `src/server.ts` -> `src/app.ts`

### Auth (NestJS) — стандартная структура NestJS

```
src/
├── auth/
│   ├── auth.controller.ts       # Декораторы + декораторы Swagger
│   ├── auth.service.ts          # Бизнес-логика
│   ├── auth.module.ts           # NestJS Module
│   ├── dto/                     # DTO с class-validator
│   ├── guard/                   # JWT Guard
│   ├── strategy/                # Passport Strategy
│   └── decorator/               # Кастомные декораторы (@User())
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
└── main.ts
```

Файлы тестов — рядом с тестовыми единицами: `*.spec.ts`, `*.service.spec.ts`.

### Customer (Next.js) — App Router + Feature-Sliced

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Route group — авторизация
│   │   └── auth/
│   │       ├── signin/page.tsx
│   │       └── register/page.tsx
│   └── (content)/                # Route group — контент
│       ├── products/[productId]/page.tsx
│       └── orders/[orderId]/page.tsx
├── common/                       # Shared — типы, хелперы, схемы
│   ├── types/                    # `.types.ts` файлы
│   ├── helpers/                  # Утилиты
│   ├── constants/                # Константы
│   ├── zodSchemes/               # Zod схемы валидации
│   └── regexp/                   # Регулярные выражения
├── components/                   # Общие UI компоненты
│   ├── ui/                       # shadcn/ui компоненты
│   ├── skeletons/                # Костяки загрузки
│   └── providers/                # Провайдеры (theme, progress bar)
├── features/                     # Фичи по доменам
│   └── auth/
│       ├── SignIn/index.tsx
│       └── Register/index.tsx
├── hooks/                        # Кастомные хуки
└── lib/                          # Утилиты уровня приложения (cn)
```

## TypeScript паттерны

### Типы vs Интерфейсы

- **`type`** для простых объектов-пропсов и DTO: `type UserData = { email: string; ... }`
- **`interface`** для более сложных структур с вложенностью: `interface Product`, `interface Impression`, `interface ProductOverview`
- **`enum`** везде где нужен фиксированный набор значений: `Gender`, `Currency`, `ProductCategory`, `ProductStatus`, `ProductVisibility`, `PropertyLabel`

### Enum-стиль

String-enums (значение совпадает с именем):
```typescript
export enum ProductCategory {
  Electronics = "Electronics",
  Fashion = "Fashion",
  // ...
}
```

Numeric enums (без явных значений):
```typescript
export enum Gender {
  Male,
  Female,
}
```

### Generics

Используются в хуках и утилитах:
- `useDebounce<T>` — debounce с сохранением типа
- `postItem<TData>`, `patchItem<TData>`, `putItem<TData>` — SWR-обёртки с типизацией аргумента

### Inferred типы от Zod

Типы выводятся из схем валидации, но также дублируются явными типами:
```typescript
export const signInFormSchema = z.object({ ... });
// Тип SignInCredentials определён отдельно в auth.types.ts
```

### `as any` использование

Встречается в `product.service.ts`:
```typescript
const { impressions, properties, _count, ...rest } = product as any;
```
Это обходное решение для деструктуризации Prisma-результата с `_count`. Не является паттерном — это workaround.

### React.FC не используется

Компоненты определяются как именованные функции:
```typescript
function Button({ className, variant, size, asChild = false, ...props }) { ... }
```

## Обработка ошибок

### API (Express)

Единый `handleErrors` в `common/helpers/errorHandler.ts`:
```typescript
export const handleErrors = (res: Response, err: any) => {
  if (err instanceof Error) {
    res.status(StatusCodes.BAD_REQUEST).json({ message: err.message });
  } else {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR)
       .json({ message: ReasonPhrases.INTERNAL_SERVER_ERROR });
  }
};
```

Каждый контроллер оборачивает методы в `try/catch` с вызовом `handleErrors`.

**Важно**: API не использует единый envelope-ответ (`{ success, data, error }`). Контроллеры возвращают сырые данные напрямую.

### Auth (NestJS)

NestJS built-in исключения:
```typescript
throw new ForbiddenException('The user already exists');
throw new ForbiddenException('The user does not exist');
throw new ForbiddenException('Password is incorrect');
```

Перехват Prisma-специфичных ошибок:
```typescript
if (err instanceof PrismaClientKnownRequestError) {
  if (err.code === 'P2002') { // Unique constraint violation
    throw new ForbiddenException('The user already exists');
  }
}
```

### Frontend

Axios error handling с `axios.isAxiosError()` проверкой:
```typescript
if (axios.isAxiosError(error) && error.response) {
  if (error.response.status === 403) { ... }
}
```

Toast-уведомления через `sonner`:
```typescript
showToast({ title: "Error", description: "...", type: "error" });
```

### Console.log

Встречаются `console.log` в production-коде:
- `apps/api-astrum/src/server.ts`: `console.log('API Gateway running at http://...')`
- `apps/customer/src/hooks/useFetcher.ts`: `console.error("GET request failed:", ...)`
- `apps/customer/src/hooks/auth/useAuth.ts`: `console.log(res.data)` — дебаг-строка

## Логирование

- API Express: `morgan('dev')` для HTTP-логов
- Auth NestJS: без кастомного логгера, только встроенный NestJS
- Frontend: `console.error` в catch-блоках, `console.log` для отладки
- Нет единого логгера (winston, pino и т.п.) — только стандартные средства

## Формат API-ответов

### Auth service (NestJS)

Возвращает объект с токеном:
```json
{ "token": "...", "expiresIn": "1d" }
```

### API Gateway (Express)

Без envelope — возвращает данные напрямую:
```json
// GET /api/products/recommendations
{
  "products": [...],
  "nextCursor": "abc123",
  "hasNextPage": true
}
```

### Ошибки

Express-ошибки:
```json
{ "message": "Product not found" }
```

Ошибки валидации DTO:
```json
{
  "errors": [
    { "property": "email", "constraints": { "isEmail": "..." } }
  ]
}
```

## Валидация

- **API (Express)** — `class-validator` + `class-transformer` через middleware `validateDto`
- **Auth (NestJS)** — `class-validator` декораторы на свойствах DTO
- **Frontend** — `zod` схемы + `@hookform/resolvers` для react-hook-form

## Документация (Swagger/JSDoc)

- **Auth (NestJS)**: `@nestjs/swagger` с декораторами `@ApiProperty`, `@ApiOperation`, `@ApiResponse`, `@ApiTags`
- **API (Express)**: Без Swagger
- **Frontend**: Без JSDoc-документации
- **Комментарии к коду**: Минимальные, в основном только JSDoc отсутствует

## CI/CD Pre-commit хуки

- `pre-commit`: `lint-staged` (валидация JSON файлов)
- `commit-msg`: Conventional commits (`feat|fix|docs|style|refactor|test|chore|ci|build|perf`)

## Турбо-таски

```
build -> зависит от ^build, ^db:generate
dev -> persistent, cache: false
lint -> зависит от ^build
check-types -> зависит от ^check-types
```
