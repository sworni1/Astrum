# 0029. Enum labels follow the chosen language

**Date**: 2026-11-19
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The storefront prints two sets of English words inside a translated interface: the twenty seven product property labels arrive from a database enum and print as their own member name, and the category strip is a hand written list of nine English names while the schema holds ten categories. A reader who picks Russian sees a Russian interface with an English catalogue inside it. This spec moves both label sets into the message catalogs behind one small helper module, builds the category strip from the enum instead of a hand written list of nine names, and adds a test that fails when an enum value gains no catalog key in either language. Categories gain `Office`, which holds 245 published products today and appears on no screen. The values of a property (the word `пластик` inside a material row) stay as they are written, because the database holds 6617 distinct strings.

## Requirements

**User stories**:

- As a customer reading Russian, I want the category names and the property labels in Russian too, so that the interface does not switch language in the middle of a page.
- As the shop, I want the category list to come from one place, so that a category that holds products cannot be missing from navigation.
- As a developer, I want a failing test when an enum value has no label, so that the interface never ships an English word into a translated screen.

**Acceptance criteria** (the contract):

- **AC-1**: `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` each gain one new top level section `enums` holding two groups: `enums.category` with exactly one key per `ProductCategory` member (10 keys) and `enums.property` with exactly one key per `PropertyLabel` member (27 keys). The key is the member name verbatim (`enums.category.Office`, `enums.property.EnergyEfficiency`), and every value is a non empty string. The copy is the table in **Label copy** below. Every existing key of every existing section stays, with its text unchanged, and the `enru` key trees stay equal, which `src/i18n/__tests__/config.test.ts:33` already checks.

- **AC-2**: The two client mirrors reach the size of the schema they mirror. `ProductCategory` in `apps/customer/src/common/types/product.types.ts:61` gains `Office = "Office"` for 10 members, and `PropertyLabel` at `apps/customer/src/common/types/product.types.ts:44` gains the 13 members it lacks (`Type`, `Power`, `Features`, `Control`, `NoiseLevel`, `PowerSource`, `Display`, `Capacity`, `Installation`, `Speed`, `Construction`, `RAM`, `Connectivity`) for 27 members. Each member keeps the shape `Name = "Name"`, in the order `packages/Astrum-db/prisma/schema.prisma:276` and `:306` list them. No other declaration of either enum exists in the storefront, and none may be added.

- **AC-3**: One new module `apps/customer/src/common/helpers/localizeHelper.ts` owns the mapping, following the shape `src/common/helpers/staffRoles.ts` already uses for the two staff roles. It exports: `CategoryLabelKey`, the union `category.<ProductCategory>`; `PropertyLabelKey`, the union `property.<PropertyLabel>`; `categoryLabelKey(value: ProductCategory): CategoryLabelKey`; `propertyLabelKey(value: PropertyLabel): PropertyLabelKey`; `categorySlug(value: ProductCategory): string` returning the member name in lower case; `categoryFromSlug(slug: string): ProductCategory | null`, which lower cases the slug before matching, because the page hands it the raw URL segment; and `isPropertyLabel(value: string): value is PropertyLabel`. Both key helpers return the key relative to the `enums` namespace, so a screen calls `useTranslations("enums")` and then `t(categoryLabelKey(value))`, exactly as the profile calls `t(staffRoleLabelKey(role))`. The module holds no React import, no catalog text and no table of its own beyond the two lookups the helpers need, and it carries a suite beside it in `__tests__/localizeHelper.test.ts`.

- **AC-4**: The category strip stops being a hand written list. `apps/customer/src/common/constants/category.list.ts` stops holding English names and exports the ten `ProductCategory` members in schema order (`Electronics`, `Fashion`, `Home`, `Food`, `Beauty`, `Books`, `Sports`, `Toys`, `Automotive`, `Office`), and every consumer prints `t(categoryLabelKey(value))` and links `/categories/${categorySlug(value)}`. The three consumers move with it: `features/pages/Categories/index.tsx:16` (a server component, so `getTranslations("enums")`), `features/layout/Navbar/Searchbar/LaptopSearchbar/index.tsx:83` and `features/layout/Navbar/Searchbar/MobileSearchbar/index.tsx:113` (client components, so `useTranslations("enums")`). After the change the file holds no English word, `Office` renders as the tenth tile, and no link path spells a category name by hand.

- **AC-5**: Both search menus keep the `all` choice the form starts on, label it from the existing `allCategories` key, and list the same ten categories in the same order as the strip, labelled through AC-3 and valued with the lower case slug. The search form keeps its two fields (`category`, `search_query`), its submit path to `/categories/<slug>/?search_query=…`, and the `all` value behaviour it has today. Each menu holds two translation hooks: the existing `nav` one for its field labels, including `nav.allCategories` (`All` / `Все`) which labels the `all` choice, and `enums` for the ten category labels. No existing key moves.

- **AC-6**: `features/pages/Categories/CategoryPage/index.tsx` prints the translated category name as its heading instead of `catalog.results`. It resolves the name from the `category` path parameter through `categoryFromSlug`, prints `t(categoryLabelKey(value))` when the slug matches a member, and keeps the existing `catalog.results` heading when it does not, so an address nobody serves keeps the heading the screen has today. The page is a client component and keeps `useTranslations`, so the name it prints is the chosen language. Both search menus submit to this same page with a `search_query` (`LaptopSearchbar/index.tsx:39`), and the heading prints the category name in that case too: this spec adds no separate search heading, and the results block keeps the copy it carries today.

- **AC-7**: A category with no products prints a new key `catalog.emptyCategory` (`No products in this category yet` / `В этой категории пока нет товаров`) where the empty branch of `CategoryPage/index.tsx:51` prints `catalog.end` today. The branch gains a guard, so the new copy appears only when the read has answered and the list is empty: while the first page is in flight the screen keeps the skeleton it renders now, and a failed read keeps its toast and its rendered state, because `products` is an empty array in both cases today. `catalog.end` keeps its current text and its current use, the end of the infinite scroll. Five of the ten categories hold no published products today (`Fashion`, `Food`, `Beauty`, `Books`, `Sports`), so this state is visible from the strip.

- **AC-8**: Product property labels print translated. `features/pages/ProductOverview/index.tsx:119` prints `t(propertyLabelKey(property.label))` from `useTranslations("enums")` instead of the raw `property.label`. The row passes `String(property.label)` to the guard, because the client type declares `label` as `PropertyLabel` (`product.types.ts:103`) and a guard applied to that type narrows its refusal branch to `never`. When the payload carries a value `isPropertyLabel` refuses, the row prints the raw value it received, never a blank and never a key path, the same fallback the profile form writes inline for `gender` at `features/pages/Profile/actions/EditProfileForm/index.tsx:169`. The property value beside it is printed exactly as the database holds it.

- **AC-9**: In the Russian locale no English enum value and no hand written category name reaches a screen. The check is a grep over `apps/customer/src` for the ten category words and the 27 property words as string literals outside `common/types/product.types.ts` and outside `__tests__/`, and it comes back empty; the rendered proof is AC-12.

- **AC-10**: A new suite `apps/customer/src/common/helpers/__tests__/localizeHelper.test.ts` holds three lists to each other and fails when any pair disagrees: the members of the two enums in `packages/Astrum-db/prisma/schema.prisma`, the members of the two client mirrors, and the keys of both catalogs, which it reads through the `@messages/*` alias. The schema is the source it parses, because the generated client is not committed (`apps/api-astrum/.gitignore` lists `/generated/prisma`); it resolves the schema from the package root at `../../packages/Astrum-db/prisma/schema.prisma` and fails with the absolute path it tried when the file is missing. It fails when any of these is false: every schema member has a member in the client mirror and in both catalogs, which is the direction that has already broken (27 schema labels against 14 mirrored ones); no catalog key or mirror member exists without a schema member; the member order matches the schema; every catalog value is a non empty string in both languages. The suite also covers AC-3's helpers and AC-8's fallback. The en and ru key tree equality and the placeholder equality stay where they are, in `src/i18n/__tests__/config.test.ts`, and are not duplicated.

- **AC-11**: The api stops keeping its own copy of the slug table. `apps/api-astrum/src/common/helpers/productCategoryMap.ts` is deleted and `apps/api-astrum/src/modules/product/product.controller.ts:50` resolves the path parameter through a derived lookup over the runtime members of `ProductCategory`. The runtime value comes from `apps/api-astrum/generated/prisma/enums.ts:111`, which is generated and gitignored, so the build runs `pnpm db:generate` before it types and the controller takes the const import in place of the type only import it carries today. The lookup lower cases the segment first, as the controller does today (`product.controller.ts:51`), so `/categories/Office` and `/categories/office` resolve to the same page. A known slug answers exactly what it answers today: same products, same filters, same cache key. An unknown slug keeps today's behaviour, which is the defect recorded in `## Follow-up` and not a part of this change: the request reaches the service with no category filter and answers the catalogue.

- **AC-12**: On the live storefront, pressing the language switch repaints every label of AC-1 to AC-8 in the chosen language without a manual reload: the strip on `/categories`, the only screen that renders one, both search menus, the heading of a category page, the empty copy of an empty category, and the property labels of a product. The switch path is unchanged (`components/LocaleSwitcher.tsx` writing the cookie through `common/actions/locale.ts` and then `router.refresh()`), and the catalogue prints the same labels in English when the switch goes back.

## Decision

**Chosen option**: Option 1, a catalog section with typed key helpers and a coverage test.

Both enum label sets move into the message catalogs as one `enums` section, one typed key helper per enum in `src/common/helpers/localizeHelper.ts`, the category strip derives from the enum, and a strict coverage test holds the three lists together: the schema, the client mirrors and the two catalogs. Property values stay untouched.

**Implementation skills**: none installed that shape this decision. The storefront conventions this build obeys live in `apps/customer/AGENTS.md` (S1 to S5), not in a community skill.

## Feature design

**Data model sketch**:

No entity, no column, no migration. The database keeps `ProductCategory`, `PropertyLabel` and the free text `ProductProperty.value`. The change is three client side tables that must agree:

| Table | Lives in | Holds | Fails when it drifts |
|---|---|---|---|
| `ProductCategory`, `PropertyLabel` | `src/common/types/product.types.ts` | 10 and 27 members, same order as the schema | the coverage test (AC-10) |
| `enums` section | `messages/en.json`, `messages/ru.json` | one key per member, 10 and 27 | the coverage test (AC-10) |
| `category.list.ts` | `src/common/constants/` | the ten members in schema order | nothing to drift, it reads the enum |

**State transitions**: none. No lifecycle change.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/products/categories/:category` | GET | `category` path parameter, lower case slug | the same page of products as today | public | unchanged |

No endpoint is added, removed or reshaped. The only server change is where the slug table comes from (AC-11).

**Value sourcing**:

| Action | Value displayed | Source |
|---|---|---|
| strip tile | category label | `enums.category.<member>` through `categoryLabelKey`, catalog text |
| strip tile and search menu | category link | `categorySlug`, lower case member name |
| search menu | slug the form submits | `categorySlug` |
| category page heading | category label | `categoryFromSlug` on the path parameter, then `categoryLabelKey` |
| category page heading, unknown slug | `catalog.results` | existing key, unchanged |
| empty category | empty copy | new key `catalog.emptyCategory` |
| product property row | label | `enums.property.<member>` through `propertyLabelKey` |
| product property row | value | `ProductProperty.value`, printed as stored |
| property label the mirror lacks | the raw payload value | the payload itself, through `isPropertyLabel` refusing |

**Label copy** (the exact text both catalogs carry; the builder writes these, it does not invent them):

| Key | en | ru |
|---|---|---|
| `enums.category.Electronics` | Electronics | Электроника |
| `enums.category.Fashion` | Fashion | Мода |
| `enums.category.Home` | Home | Дом |
| `enums.category.Food` | Food | Еда |
| `enums.category.Beauty` | Beauty | Красота |
| `enums.category.Books` | Books | Книги |
| `enums.category.Sports` | Sports | Спорт |
| `enums.category.Toys` | Toys | Игрушки |
| `enums.category.Automotive` | Automotive | Авто |
| `enums.category.Office` | Office | Офис |
| `enums.property.Color` | Colour | Цвет |
| `enums.property.Size` | Size | Размер |
| `enums.property.Material` | Material | Материал |
| `enums.property.Brand` | Brand | Бренд |
| `enums.property.Weight` | Weight | Вес |
| `enums.property.Dimensions` | Dimensions | Габариты |
| `enums.property.Warranty` | Warranty | Гарантия |
| `enums.property.EnergyEfficiency` | Energy efficiency | Энергоэффективность |
| `enums.property.StorageCapacity` | Storage capacity | Объём памяти |
| `enums.property.OperatingSystem` | Operating system | Операционная система |
| `enums.property.Processor` | Processor | Процессор |
| `enums.property.GraphicsCard` | Graphics card | Видеокарта |
| `enums.property.ScreenSize` | Screen size | Диагональ экрана |
| `enums.property.BatteryLife` | Battery life | Время работы |
| `enums.property.Type` | Type | Тип |
| `enums.property.Power` | Power | Мощность |
| `enums.property.Features` | Features | Особенности |
| `enums.property.Control` | Control | Управление |
| `enums.property.NoiseLevel` | Noise level | Уровень шума |
| `enums.property.PowerSource` | Power source | Питание |
| `enums.property.Display` | Display | Дисплей |
| `enums.property.Capacity` | Capacity | Ёмкость |
| `enums.property.Installation` | Installation | Установка |
| `enums.property.Speed` | Speed | Скорость |
| `enums.property.Construction` | Construction | Конструкция |
| `enums.property.RAM` | RAM | Оперативная память |
| `enums.property.Connectivity` | Connectivity | Подключения |

**Key invariants**:

- One key per enum member, in both catalogs, always; a member without a key fails the suite rather than printing English.
- The category list is derived, never hand written, so a category holding products cannot be missing from navigation.
- The slug stays the lower case member name in English on both sides, so an address does not change with the language.
- A property label the client mirror does not know prints the raw value; it never prints a key path and never prints nothing.

**Security model**: unchanged. The catalogue, the strip and the product page are public reads; the api change touches no guard, no ownership rule and no session path.

**Configuration required**: none. No new environment variable, no flag, no credential.

**Critical test scenarios** (each maps to an acceptance criterion):

- Happy path: a Russian reader opens `/categories`, sees ten Russian names including Офис, opens a category, sees the Russian heading, then opens a product whose properties print Russian labels beside the stored values, verifies **AC-12**, **AC-4**, **AC-6**, **AC-8**.
- Coverage: a member added to `ProductCategory` without a catalog key fails the suite, and so does a catalog key without a member, verifies **AC-10**.
- Fallback: a property label the mirror refuses prints the payload value, verifies **AC-8**.
- Empty state: `/categories/fashion` prints the new empty copy instead of the end of list copy, verifies **AC-7**.
- Server side: `/api/products/categories/office` answers the Office products and `/api/products/categories/electronics` answers exactly the page it answers today, verifies **AC-11**.

## Build plan

The project builds by Tracer Bullet, so the first task carries one label all the way through the catalogs, the helper and a screen, and every later task thickens that thread. No task touches the database.

1. Thin thread, one label end to end for `Office`: add the `enums.category` group with the `Office` key to both catalogs, add `Office` to the client `ProductCategory`, write `localizeHelper.ts` with `categoryLabelKey` and `categorySlug`, and make `features/pages/Categories/index.tsx` render the ten tiles from the derived list, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**. — done: `messages/{en,ru}.json` carry all ten `enums.category` keys at once, `product.types.ts` has `Office`, `localizeHelper.ts` exports the seven helpers, `category.list.ts` holds the ten members, the strip renders `enumT(categoryLabelKey(category))` over `/categories/${categorySlug(category)}`
2. The remaining nine category keys in both catalogs plus both search menus on the same helpers, satisfies **AC-1**, **AC-4**, **AC-5**. — done: both menus import the helpers and value each item with `categorySlug(category)`, keeping the `all` choice and `nav.allCategories`
3. The category page: heading from `categoryFromSlug` with its `catalog.results` fallback, and `catalog.emptyCategory` in the empty branch of both catalogs, satisfies **AC-6**, **AC-7**. — done: `CategoryPage/index.tsx` prints the member name, keeps `catalog.results` for an unknown slug, and prints the new copy only when the read answered and the list is empty
4. Property labels: the 27 `enums.property` keys in both catalogs, the 13 missing members in the client enum, `propertyLabelKey` and `isPropertyLabel` in the helper, and `ProductOverview` printing through them, satisfies **AC-1**, **AC-2**, **AC-8**. — done: the 27 keys in both catalogs, the mirror at 27 members, and the specification row prints `enumT(propertyLabelKey(label))` with the raw payload value as fallback
5. The coverage suite beside the helper: parse the two schema enums, hold the client mirrors and both catalogs to them in every direction including the member order, and cover the helpers and the raw fallback, satisfies **AC-10**, **AC-8**. — done: `src/common/helpers/__tests__/localizeHelper.test.ts`, 9 cases, green
6. The api resolver: delete `productCategoryMap.ts`, run `pnpm db:generate`, import the runtime `ProductCategory` const from `generated/prisma/enums`, resolve the lower cased slug in `product.controller.ts`, keep the unknown slug answer as it is today, satisfies **AC-11**. — done: the map file is deleted, the controller resolves through `Object.values(ProductCategory)`, `pnpm --filter @astrum/api check-types` and its jest suite pass
7. The sweep: the grep of AC-9 over `apps/customer/src`, both locales driven on the live storefront for the labels of AC-1 to AC-8, and `pnpm --filter @astrum/customer lint`, `test` and `check-types` plus the api types, satisfies **AC-9**, **AC-12**. — done for the static half: the AC-9 grep comes back empty, customer lint 0 errors, customer suite 467 cases in 88 files, customer and api check-types pass. The live two locale drive stays for `/check verify` (AC-12)

## Consequences

**Positive**:

- The category strip can no longer miss a category that holds products; `Office` with its 245 published products becomes reachable from navigation.
- A new enum member breaks the test suite instead of leaking an English word into a translated screen.
- The slug has one source on both sides, so the storefront and the gateway cannot disagree about an address.
- The hand written list disappears, and with it one place per language that had to be remembered.

**Negative / tradeoffs**:

- Both catalogs grow by 37 keys, and every future enum member costs three edits (schema, mirror, two catalogs) before the suite goes green again. That friction is the point and reads as a delay the first time it happens.
- Ten tiles replace nine, and five of them open an empty category, so the strip becomes visibly wider than the stocked catalogue until more products land.
- The strip now depends on the schema order, so reordering the schema reorders navigation, which a reader may not expect.
- Property labels gain a key layer, so a product row now fails silently to a raw value when the mirror falls behind, and a reader sees one English word among Russian ones until the next deploy.

**Neutral**:

- No migration, no new dependency, no configuration. The build touches two message files, one types file, one constant module, one new helper with its suite, four screen files and one api helper removal.

## Follow-up

- [ ] Property values stay as written. The database holds 27721 property rows and 6617 distinct values, seeded in Russian from the Excel catalogue (`пластик` 559 times, `черный` 526, `Li-ion` 440), so an English reader still sees Russian values beside English labels. This spec does not fix that; a value vocabulary is a data decision of its own.
- [ ] An unknown category slug answers the whole catalogue. `product.controller.ts` resolves the path parameter and today a miss leaves the filter unset, so `/api/products/categories/nonsense` answers every product. This spec keeps that behaviour as it found it; whether the route should answer `404` or a validation error is its own decision.
- [ ] A search with the `all` category lands in the recommendations cache slot. When no category reaches the service the cache key is `cacheKeys.recommendations(epoch, cursor)` (`product.service.ts:107`), so a name search sent from the menu shares the key the home recommendations block reads, and with `search_query` set the filtered result is what lands there. This spec leaves the key untouched; it is a cache defect of its own.
- [ ] The delivery method names owed in `docs/scope/_root/scope.md` stay owed and out of this spec, which covers enum labels only.
- [ ] The scope row `17. Enum labels follow the chosen language` needed three corrections from this design and they are applied in the same pass: the category badge it promised does not exist in the code and is dropped, the empty category copy and the category page heading are added, and the strip becomes ten tiles instead of nine.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
