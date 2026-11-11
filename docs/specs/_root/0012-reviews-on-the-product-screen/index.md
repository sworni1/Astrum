# 0012. Reviews on the product screen

**Date**: 2026-11-11
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The reviews block on the product screen is a demo: four invented reviews of products that do not exist, invented like and comment counters, and a form that collects a name, an email and a rating and then sends nothing. The gateway already ships a reviews module, but the product id never reaches it, nothing in the repository ever sets a review to `APPROVED`, and every refusal in it is a plain `Error` that the error handler answers as `500`. This decision puts the block on the real data, makes a written review appear immediately, and closes the write path from the delivered order line to the list. Nothing new runs: no table, no service, no migration.

## Requirements

**User stories**:

- As a customer, I want to read the real reviews of the product I am looking at, with its real average and its real count, so that I can judge it before buying.
- As a customer whose order line has been delivered, I want to write one review from the product screen and see it there at once, so that the writing does not end in silence.
- As a customer who has not bought the product, I want the block to tell me why I cannot write one, so that I do not fill a form that is refused.
- As the shop, I want the published rating to come from reviews that only a buyer could write, so that the number on the screen means something.

**Acceptance criteria** (the contract):

- **AC-1**: The block renders reviews answered by the gateway for the product in the page path. No demo review data survives anywhere in `apps/customer/src`: `grep -rn "DEMO_REVIEWS\|notion-avatars" apps/customer/src` returns no match, and `apps/customer/src/features/pages/ProductOverview/Reviews/lib/reviews.ts` is deleted.
- **AC-2**: A review card shows the author, the overall stars, the date, the comment and, when the row carries them, the photos (each with the `reviews.photoAlt` copy naming its index). The author is `authorName` when the gateway answered one and the `reviews.anonymousBuyer` copy when it answered `null`; there is no avatar, because `Review` carries no avatar column and the demo URL service is gone. The card shows the three detail ratings as a labelled line (quality, delivery, accuracy), because the form collects them and a value nobody displays is a value nobody should have been asked for. The card carries no like counter and no comment counter: both controls stay rendered with `aria-disabled="true"`, no number beside them, and the `reviews.comingSoon` copy that says the feature arrives later.
- **AC-3**: The summary above the list reads `aggregate.averageRating` with one decimal, `aggregate.total`, and five rows of the star distribution built from `aggregate.distribution`. A row prints its integer share of the total, computed as `Math.round(count * 100 / total)`, and the five shares are not forced to add up to 100, because rounding does not divide evenly. A row with a count of `0` prints `0%`. When `aggregate.total` is `0` the summary is not rendered at all and the empty state takes its place, so the screen never prints an average of zero.
- **AC-4**: The list pages by cursor. The first page asks for 20 reviews. `nextCursor` with `hasNextPage` true renders a `Показать ещё` control that appends the next page below the current one, and the control disappears when `hasNextPage` is false. Appending never repeats an id already on screen, and the order stays the order the gateway answered (newest first, ties broken by id). The first page is the only source of `aggregate` for the whole screen, whatever pages were appended after it, and an appended page that shifted under a concurrent write is accepted as it answered rather than re read. The header summary and the block read one key, so the product screen sends exactly one request for the first page, not two.
- **AC-5**: The rating line in the product header reads the same aggregate as the block (the average with one decimal through `reviews.summaryAverage` and the total through `reviews.count`), links to `#reviews`, and `_count.impressions` no longer stands for a review count anywhere on this screen. Before the aggregate arrives the line renders a placeholder of the same width, never five filled stars.
- **AC-6**: When the product has no reviews the block renders an honest empty state: the `reviews.emptyTitle` and `reviews.emptyText` copy, no invented review, and the write control only when the customer may write one (AC-7). A failed read renders a visible error state with a `reviews.retry` control, and the `reviews.loadFailed` toast is raised from an effect owned by the block, because `getData` in `useFetcher` only logs and rethrows and the storefront standard (S4) forbids raising a toast from a render body.
- **AC-7**: The write path is driven by `reviewState`, answered by `GET /api/products/:productId` as `{ status, orderItemId }` because that answer is already per customer (`isWishlisted`, `quantityInCart`). The three values have three behaviours. `ELIGIBLE`: the `Написать отзыв` control is rendered and carries `orderItemId` into the request. `NOT_PURCHASED`: no control, plus the `reviews.onlyAfterDelivery` line. `ALREADY_REVIEWED`: no control, plus the `reviews.alreadyReviewed` line. `status` is `ELIGIBLE` while any delivered line of this customer for this product carries no review, and when several do, `orderItemId` is the one whose order was created last (`order.createdAt desc`, ties by line `id asc`). A state the client does not know (a value added to the gateway later) renders no control and no explanation rather than a wrong one.
- **AC-8**: The write control opens a dialog holding the four ratings (overall, quality, delivery, accuracy), each a radio group of five stars, and a comment field. The client schema mirrors the DTO: each rating is an integer from 1 to 5 and is required, the comment is trimmed and then holds 5 to 2000 characters, where the length counts UTF-16 units on both sides so the browser and the server agree on an emoji. The submit control is enabled and validation runs on press: a failing field shows its message under the field, nothing is sent, and the request only leaves when the whole schema passes. While the request runs the submit control carries the `reviews.busy` label, is disabled, and its handler returns before sending again, so a repeated press sends no second request. Escape and the cancel control close the dialog without a request.
- **AC-9**: A `201` closes the dialog, raises the `reviews.saved` toast, writes the answered review into the cached first page or revalidates that key, and revalidates the product key so `reviewState` is re read. The new review stands first in the list, and the write control is gone once no delivered line of this customer for this product remains unreviewed; a customer with a second delivered line keeps the control, because the second line is still reviewable.
- **AC-10**: Every refusal surfaces by code, keeps the dialog open with what the customer typed, and re reads the list and the product key through `Promise.allSettled` before the handler returns, so a failed re read never rejects out of it. `REVIEW_ONLY_AFTER_DELIVERY` raises `reviews.refused.notDelivered`; `REVIEW_ALREADY_EXISTS` raises `reviews.refused.alreadyReviewed`; `REVIEW_PRODUCT_MISMATCH`, `REVIEW_ORDER_ITEM_NOT_FOUND` and any other answered `4xx` raise `reviews.refused.generic`; a `400` carrying a validation `errors` array raises `reviews.refused.invalid` and prints the field messages under the fields; a failure with no answer at all raises `reviews.refused.unconfirmed`, because the gateway may have committed the review before the answer was lost. `403 EMAIL_NOT_CONFIRMED` raises the existing `errors.emailNotConfirmed*` toast with its resend action, and it can only do so once `refusalCode` in `apps/customer/src/hooks/useFetcher.ts` reads the code on a `403` as well as a `401`: today it returns `undefined` for every status but `401`, so the `EMAIL_NOT_CONFIRMED` branch it already contains is unreachable.
- **AC-11**: `POST /api/products/:productId/reviews` publishes: the row is created with `status: APPROVED`. The product comes from the path only. `productReviewsRouter` is created with `mergeParams: true` and the controller reads `req.params.productId`, because a child router does not inherit the parent's params and the controller reads a param named `id` today, so the service has been receiving `undefined` and Prisma has been dropping the condition. A `productId` in the body is ignored, because it leaves the DTO. The order line is looked up by `id` and the authenticated `userId`: a missing line answers `404` with code `REVIEW_ORDER_ITEM_NOT_FOUND`, a line of another product answers `403` with `REVIEW_PRODUCT_MISMATCH`, a line that is not `DELIVERED` answers `403` with `REVIEW_ONLY_AFTER_DELIVERY`, and a second review for the same line answers `409` with `REVIEW_ALREADY_EXISTS`, produced by catching Prisma `P2002` on the `orderItemId` unique index, so two simultaneous submits answer one `201` and one `409` and never a `500`. The `201` body and every list row come from one serializer, so the fields the screen reads are the same from both routes. No method in `ReviewsService` throws a bare `Error` any more, `getReviewById` included: its not found branch answers `404` with `REVIEW_NOT_FOUND` instead of a `500`. Every code lives in one `REVIEW_ERROR_CODES` table beside the module, in the shape `order.constants.ts` already uses.
- **AC-12**: `GET /api/products/:productId/reviews` answers the list and the aggregate, and nothing about the caller. `limit` is an integer clamped to 1 through 50 and defaults to 20, and a value that is not a number answers `400` with `REVIEW_INVALID_PAGINATION`; `after` must be an id that exists and belongs to this product, and anything else answers `400` with `REVIEW_INVALID_CURSOR` rather than a page that looks finished. The page is read as `limit + 1` rows ordered by `createdAt desc` then `id desc`, because `createdAt` alone is not unique and a cursor over a non unique sort both repeats and skips rows; the extra row is dropped and `hasNextPage` is true only when it existed. Each answered review carries `id`, `authorName`, `rating`, `qualityRating`, `deliveryRating`, `accuracyRating`, `comment`, `photos` and `createdAt`, and no `userId`, `orderItemId`, `status` or `updatedAt`, because the screen uses none of them and another customer's id is not the shop's to publish. `authorName` is the author's trimmed `User.nickName`, or `null` when it is empty; the server never sends localized copy. `aggregate.distribution` is a `Record` keyed by the strings `"1"` through `"5"` holding counts, zero filled on the server for every key, and `averageRating` is rounded to two decimals. The list answers no review state, so its body is the same for every reader and safe to cache per product.
- **AC-13**: Every new string exists in `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` under `reviews`, with the same keys and the same meaning, and the catalog holds exactly the keys the block and the header read: `title`, `summaryAverage`, `count`, `distributionLabel`, `writeReview`, `dialogTitle`, `dialogText`, `ratingOverall`, `ratingQuality`, `ratingDelivery`, `ratingAccuracy`, `commentLabel`, `commentPlaceholder`, `submit`, `cancel`, `busy`, `saved`, `emptyTitle`, `emptyText`, `onlyAfterDelivery`, `alreadyReviewed`, `anonymousBuyer`, `comingSoon`, `like`, `viewComments`, `loadMore`, `loadFailed`, `retry`, `photoAlt`, `ratedOutOf`, `rate` and `refused.{notDelivered,alreadyReviewed,invalid,generic,unconfirmed}`. The header uses `summaryAverage` and `count` from this namespace, not `product.reviewsCount`. The keys the rewrite replaces are deleted from both catalogs: `description`, `formTitle`, `formDescription`, `nameLabel`, `emailLabel`, `reviewLabel`, `ratingLabel`, `namePlaceholder`, `emailPlaceholder`, `reviewPlaceholder`, `avatarAlt`, `productMissing`, `ratingMissing`, `unlike`.
- **AC-14**: The storefront code follows the standard the storefront wrote down (`apps/customer/AGENTS.md`, S1 to S5): the block is a feature folder with `index.tsx` holding composition only, each card, the summary, the empty state, the dialog and the star controls in their own files under `components/`, the tables and pure helpers in `lib/`, the two data hooks in `src/hooks/review/` and not inside the feature, `@/` imports, dates printed through `useFormatter`, money never involved, and no `console`.
- **AC-15**: The behaviour is locked by tests that fail without it. Gateway (jest): the router merges the parent's params so a request for one product never answers another's rows; a line of another product answers `403` with `REVIEW_PRODUCT_MISMATCH`; an undelivered line answers `403` with `REVIEW_ONLY_AFTER_DELIVERY`; a second review answers `409` from `P2002`; the created row reads `APPROVED` and takes its product from the path, not the body; the `201` body and a list row carry the same fields; a product with two delivered lines answers the newer `orderItemId`; the list answers `authorName: null` for an empty nickname, zero fills the five distribution keys, drops the extra row, clamps `limit`, refuses a foreign `after`, and orders ties by id. Storefront (vitest): the schema refuses a 4 character comment and a missing detail rating; the refusal table maps all six branches; the summary prints one decimal and a zero share; loading a second page appends without a repeat; the dialog sends nothing while a field fails and once only per press; the empty state and the two blocked states render their own copy. `pnpm --filter @astrum/api test`, `pnpm --filter @astrum/customer test` and `pnpm --filter @astrum/customer lint` pass.

## Decision

**Chosen option**: Option 1: finish the existing module in place and publish on write.

Keep the two existing routes, the one service and the one table. Make the row `APPROVED` at creation, narrow and extend the read answer to what the screen needs, carry the caller's review state in the product answer that already answers per customer facts, and replace the demo block with a feature folder that reads and writes those routes.

**Implementation skills**: none installed that shape this decision; `apps/customer/AGENTS.md` (its `## Coding standard`, S1 to S5) and `apps/customer/CODE_REVIEW.md` govern the storefront part and were followed.

## Rationale

Reasoning, options and the measured state before the decision: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**: no new table and no migration. The decision reads and writes the columns that already exist:

| Entity | Field | Use in this decision |
|---|---|---|
| `Review` | `id`, `userId`, `productId`, `orderItemId` (unique), `rating`, `qualityRating`, `deliveryRating`, `accuracyRating`, `comment`, `photos`, `status`, `createdAt` | The whole review. `orderItemId` unique is the rule that stops a second review for one line. |
| `OrderItem` | `id`, `userId`, `productId`, `status` | The purchase proof. A line qualifies when `status` is `DELIVERED` and it carries no review. |
| `User` | `nickName` | The author name, `null` when empty. |

**State transitions**:

- `Review`: absent, then `APPROVED` at creation. `PENDING` and `REJECTED` are written by nothing in this decision (see Follow-up).
- `reviewState.status` is derived on every read, never stored: `ELIGIBLE` when one delivered line of this customer and this product carries no review, `ALREADY_REVIEWED` when no such line exists but this customer already has a review on this product, `NOT_PURCHASED` otherwise.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/products/:productId` | GET | none new | the existing product body plus `reviewState: { status, orderItemId }` | session cookie | unchanged |
| `/api/products/:productId/reviews` | GET | `after` (review id of this product, optional), `limit` (1 to 50, default 20) | `reviews[]` (id, authorName, four ratings, comment, photos, createdAt), `nextCursor`, `hasNextPage`, `aggregate` (total, averageRating, distribution) | session cookie | `400 REVIEW_INVALID_PAGINATION`, `400 REVIEW_INVALID_CURSOR` |
| `/api/products/:productId/reviews` | POST | `orderItemId`, `rating`, `qualityRating`, `deliveryRating`, `accuracyRating`, `comment` (5 to 2000 after trim), `photos` (optional URL list, not sent by this screen) | the created review in the list shape, `201` | session cookie, `requireActiveAccount` | `404 REVIEW_ORDER_ITEM_NOT_FOUND`, `403 REVIEW_PRODUCT_MISMATCH`, `403 REVIEW_ONLY_AFTER_DELIVERY`, `403 EMAIL_NOT_CONFIRMED`, `409 REVIEW_ALREADY_EXISTS`, `400` validation `errors` |
| `/api/reviews/:reviewId` | GET | none | the raw row, shape unchanged | session cookie | `404 REVIEW_NOT_FOUND` (the `500` it answers today is fixed; the shape stays for the Follow-up) |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| product read | `reviewState.status`, `reviewState.orderItemId` | derived per customer from `OrderItem` (`userId`, `productId`, `status = DELIVERED`, no review) and `Review` (`userId`, `productId`); the picked line is `order.createdAt desc`, then line `id asc` |
| list | `authorName` | `User.nickName` through the review's `userId`, trimmed, `null` when empty |
| list | `aggregate.total`, `aggregate.averageRating` | `count` and `avg(rating)` over this product's `APPROVED` reviews, average rounded to 2 decimals |
| list | `aggregate.distribution` | `groupBy(rating)` over the same set, zero filled into a `Record` keyed `"1"` to `"5"` |
| list | `nextCursor`, `hasNextPage` | the `limit + 1` read ordered by `createdAt desc, id desc`: the id of the last kept row, and whether an extra row existed |
| list | star share percent | computed on the client from the answered integer counts, `Math.round(count * 100 / total)` |
| list | review date | `Review.createdAt` printed through `useFormatter`, browser time zone |
| create | `productId` | the path parameter, merged into the child router and read as `req.params.productId`; a body `productId` is dropped by `validateDto` |
| create | `status` | the literal `APPROVED` |
| create | `comment` | the request body, trimmed before validation and before the write |
| create | the `201` body | the same serializer that builds a list row, so `authorName` comes from `User.nickName` here too |
| create | dialog busy state, double send guard | the mutation's pending flag in `useCreateReview` |
| header | average and count | the same `aggregate` from the same SWR key the block reads |

**Key invariants**:

- One review per order item, held by the `orderItemId` unique index and translated to `409` rather than left to a `500`.
- A review always belongs to the product in the request path, so the purchase proof and the written row cannot name different products.
- The public list answers only `APPROVED` rows of the requested product, and a request whose path product cannot be read answers an error rather than every product's rows.
- `reviewState` never claims `ELIGIBLE` for a line that already carries a review.
- `averageRating` and `distribution` are computed from the same filtered set in the same request, so the printed average and the printed rows agree.

**Security model**:

- The whole storefront sits behind the session guard in `apps/customer/src/proxy.ts`, and every reviews route sits behind `authenticateToken`, so there is no anonymous read to design. The public product catalogue is not in scope.
- Writing also requires an `ACTIVE` account (`requireActiveAccount`). A `PENDING` account reads reviews and is refused on write with `403 EMAIL_NOT_CONFIRMED`.
- Only the buyer of the delivered line may review that line, proven on the server by `orderItemId` plus the authenticated `userId` plus the product in the path. The client hint in `reviewState` is never the permission.
- The list publishes a nickname the person chose and nothing else: no `userId`, no email, no order id. A nickname left empty prints the neutral copy, not the email local part.

**Configuration required**: none. No new environment variable, no flag, no credential.

**Critical test scenarios**:

- Happy path: a customer with a delivered line writes a review from the dialog; the list shows it first, the average and the count move, and the write control is gone once that was the only line, verifies **AC-8**, **AC-9**, **AC-11**
- Path case: a request carries one product id and the answer holds another product's reviews; this fails today because the child router never receives the param, verifies **AC-1**, **AC-12**
- Failure case: the same line is reviewed twice at the same moment; one `201` and one `409 REVIEW_ALREADY_EXISTS`, never a `500`, verifies **AC-11**
- Refusal case: a customer with no delivered line opens the screen; no write control and the explanation line, while a forged `POST` answers `404 REVIEW_ORDER_ITEM_NOT_FOUND` for a line that is not theirs and `403 REVIEW_ONLY_AFTER_DELIVERY` for their own undelivered line, verifies **AC-7**, **AC-10**, **AC-11**
- Empty case: a product with no reviews prints the empty state and no average, verifies **AC-3**, **AC-6**
- Paging case: a product with 25 reviews prints `Показать ещё` once, appends 5 more, and drops the control; a foreign `after` answers `400`, verifies **AC-4**, **AC-12**
- Privacy case: the list body carries no `userId` and no `orderItemId` for any review, verifies **AC-12**

## Build plan

Tracer Bullet from the scope header: the thin thread runs from the change in the gateway to the block on the screen before it thickens. No migration: this decision touches no schema, so nothing runs in the database beyond the rows the write path creates.

1. Gateway product read: derive `reviewState` for the authenticated customer, with the delivered line tiebreak, and answer it from `GET /api/products/:productId`; jest tests for the three states and for two delivered lines. Satisfies **AC-7** — done: `review-state.ts` derives the three states, `product.service` answers `reviewState`; three cases in `review-state.spec.ts`
2. Gateway reviews read: a shared serializer used by both routes, `authorName` from the user relation, the zero filled five key distribution, `limit + 1` with the `createdAt, id` ordering, the clamped `limit`, the validated `after`, and the router fix (`mergeParams: true` plus `req.params.productId`) so the product id actually arrives; `reviews.constants.ts` with `REVIEW_ERROR_CODES` and the bounds; jest tests for each. Satisfies **AC-1**, **AC-12** — done: `review.serializer.ts` (shared select and row), `reviews.constants.ts`, `Router({ mergeParams: true })`, the `createdAt, id` page with `limit + 1`, the validated cursor; `reviews.service.spec.ts` and `reviews.routes.spec.ts` (a real request through the parent router proves the path param arrives)
3. Gateway write path: drop `productId` from `CreateReviewDto`, add the 2000 character ceiling, rewrite `ReviewsService.createReview` around `AppError`, the path product, `DELIVERED`, `APPROVED` and the `P2002` to `409` translation, and move `getReviewById` onto `REVIEW_NOT_FOUND`; jest tests for the four refusals, the published row and the shared `201` body. Satisfies **AC-11** — done: DTO without `productId` and with the 2000 ceiling, `AppError` per refusal, `APPROVED` on create, `P2002` to 409, `REVIEW_NOT_FOUND`; `create-review.dto.spec.ts` and the create cases
4. Storefront data layer: `src/common/types/review.types.ts` for the answered shape, `reviewState` added to the product type, `src/hooks/review/useProductReviews.ts` (one key for page one, one key per cursor page, the merged list, the aggregate from page one) and `src/hooks/review/useCreateReview.ts` (`useSWRMutation` over `postItem`, revalidation of the reviews key and the product key on success); vitest for the append without repeats. Satisfies **AC-4**, **AC-9** — done: `review.types.ts`, `reviewState` on the product type, `useProductReviews` (one key for page one, one per cursor page, merged list, aggregate from page one), `useCreateReview`; `reviewsKeys.test.ts`
5. Thin thread through the screen: split the block into the feature folder S2 asks for, render the real list, the card with its author, stars, date, comment, detail ratings and photos, the two visibly disabled controls, the error state with its retry, and the honest empty state; delete `Reviews/lib/reviews.ts` and the demo type with it. Satisfies **AC-1**, **AC-2**, **AC-6**, **AC-14** — done: the `Reviews` feature folder (card, summary, empty, error, write action, dialog, star controls, load more), `Reviews/lib/reviews.ts` deleted
6. Summary: the average with one decimal, the total and the five distribution rows with their integer shares, hidden when the total is zero. Satisfies **AC-3** — done: `ReviewSummary` prints one decimal and the integer shares, and renders nothing at a total of zero
7. Header: the rating line reads the shared aggregate, links to `#reviews`, prints a placeholder before the data, and stops reading `_count.impressions`. Satisfies **AC-5** — done: the header reads the shared aggregate through `summaryAverage` and `count`, links to `#reviews`, prints a placeholder, and no longer reads `_count.impressions`
8. Write path on the screen: the three `reviewState` states with their own copy read through `useGetProduct`, the dialog with four star radio groups and the comment, the zod schema mirroring the DTO with validation on press, the single send with its busy guard, the success branch and the six refusal branches keyed by code, and the `refusalCode` widening in `useFetcher` so a `403` code is read at all. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10** — done: `ReviewWriteAction` three states, `WriteReviewDialog` with four native radio groups, `create-review.scheme`, the six refusal branches, the send guard, the `refusalCode` widening
9. Copy: the whole `reviews` namespace in `en.json` and `ru.json`, the listed keys added, the replaced keys deleted from both. Satisfies **AC-13** — done: the `reviews` namespace rewritten in both catalogs, the three field messages added under `validation`, `product.reviewsCount` deleted
10. Locks: the storefront vitest suites for the schema, the refusal table, the summary formatting, the paging, the dialog and the empty and blocked states, then `pnpm --filter @astrum/customer test`, `pnpm --filter @astrum/customer lint`, `pnpm --filter @astrum/api test` and `pnpm check-types`. Satisfies **AC-14**, **AC-15** — done: 30 storefront tests across the feature and the schema, `pnpm --filter @astrum/customer test`, `pnpm --filter @astrum/customer lint` (0 errors) and `pnpm check-types` clean

## Consequences

**Positive**:

- The block stops lying: every number and every name on it comes from a buyer, and the product header's rating finally means something.
- Writing a review works end to end for the first time, and the refusal path answers with a status and a code instead of a `500`.
- The list route stops answering every product's reviews, which is what it does today: the child router never received the param and the controller read a param that does not exist.
- The list body becomes identical for every reader, so it can be cached per product later without leaking one customer's state to another.
- No new table, no new service, no flag and no migration, so the cost of the change is code that already exists in part.

**Negative / tradeoffs**:

- Every review is published the moment it is written. There is no moderation and no report path, so the first abusive review stays up until someone deletes the row by hand.
- The four ratings are collected but only the overall one feeds the average and the distribution; the three detail ratings are shown per review and never aggregate, which is a cost of the schema meeting the form rather than a design.
- The like and comment controls stay on screen doing nothing until their own feature lands, which is a visible promise the block cannot keep today.
- The product answer grows a per customer field, so that response stays uncacheable for anyone but the reader. That was already true of `isWishlisted` and `quantityInCart`.

**Neutral**:

- `Product.stars`, `Product.reviewCount` and `Product.averageRating` stay as they are, written by nothing, and `ReviewsService.updateProductAggregates` still has no caller. This decision reads the aggregate instead of the columns.
- `ProductCard` and the category grid still print `_count.impressions` as a review count (Follow-up).
- `ReviewStatus.PENDING` and `ReviewStatus.REJECTED` become unreachable values until a moderation feature exists.
- One shared helper changes outside the reviews feature: `refusalCode` in `apps/customer/src/hooks/useFetcher.ts` starts reading the code on a `403`. The branches behind it only match their own codes, so no other refusal changes behaviour, and the `EMAIL_NOT_CONFIRMED` toast that was written for the order screen starts working everywhere.

## Follow-up

- [ ] Likes and comments on a review: their own spec (a reaction table, an endpoint, a counter) plus a row in `docs/scope/_root/scope.md`. Until then the two controls stay visibly disabled with the `reviews.comingSoon` copy.
- [ ] `ProductCard` prints `_count.impressions` as a review count (`apps/customer/src/features/general/ProductCard/index.tsx`, the `_count?.impressions ?? 0` line). Either read `reviewCount` and `averageRating` from a maintained column or drop the number from the card; it is the same lie this spec removes from the product screen.
- [ ] Decide the fate of the three unmaintained product columns and of `ReviewsService.updateProductAggregates`: wire it into a moderation write or delete both together.
- [ ] `GET /api/reviews/:reviewId` still answers any customer's raw row, including `userId` and reviews that are not `APPROVED`. Its error path is fixed here; the shape needs narrowing or removal once nothing reads it.
- [ ] Moderation before the shop takes strangers: every review publishes on write, `PENDING` and `REJECTED` are dead values, and there is no limit on how many reviews one account can write beyond one per delivered line.
- [ ] Photo upload: the project has no storage for files, so `photos` stays a URL list an external writer may fill and the screen renders what it receives.
