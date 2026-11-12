# 0014. Review likes and comments

**Date**: 2026-11-12
**Status**: Accepted

_This is the build spec. The decision record (context, options, rationale) lives in [rationale.md](rationale.md); the verification steps live in [verify.md](verify.md)._

## Summary

The review card carries a like control and a comment control that do nothing: both are rendered disabled and say the feature arrives later (spec 0012, AC-2). This decision finishes them. A customer with a confirmed account presses like once and the number beside it moves, presses again and the like is gone; the comment control opens a flat thread under the same card where customers read replies and write their own, and the author of a reply can delete it. Moderation stays off by the owner's call, so every like and every comment is live at once, and the only brake on abuse is a rate limit of ten comments per account per hour. It adds two tables and two counter columns, and no new service, queue or flag.

## Requirements

**User stories**:

- As a customer reading a review, I want to like it, and to see whether I already did, so that a useful review gets a signal without me writing anything.
- As a customer reading a review, I want to read the replies under it and add my own, so that a review and its discussion sit in one place.
- As a customer who wrote a reply and regrets it, I want to delete it, so that I can take my words back without losing the thread.
- As the shop, I want the two numbers on a card to be maintained by the server on every write, so that the card never prints a count that no row backs.

**Acceptance criteria** (the contract):

- **AC-1**: The card's two controls are real controls. The like control is a `button` with `aria-pressed` reflecting the caller's own state; its accessible name is `reviews.like` while unpressed and `reviews.unlike` while pressed; it prints the count from the review row's `likeCount` (always, a `0` included) as visible text marked `aria-hidden="true"`, so the Russian noun label is never glued to a number and the name a screen reader reads stays stable; and it sends a request on press. The comment control is a `button` whose accessible name is `reviews.comments.open`, with `aria-expanded` and `aria-controls` naming the thread region, it prints `commentCount` (always, a `0` included), and it opens and closes the thread without navigating. `grep -rn "comingSoon" apps/customer/src` returns no match, and `grep -n '"comingSoon"\|"viewComments"' apps/customer/messages/en.json apps/customer/messages/ru.json` returns no match.
- **AC-2**: Every review row answers `likeCount` and `commentCount` as integers taken from the stored columns, from the list route and from the write `201` alike, because both come through the one serializer (`reviewRowSelect` plus `serializeReview`). `grep -n "likeCount" apps/api-astrum/src/modules/reviews/review.serializer.ts` matches in the select, the row type and the public type.
- **AC-3**: `GET /api/products/:productId/review-likes` answers `{ reviewIds: string[] }`, the ids of the reviews of this product that the caller liked, `APPROVED` rows only, ordered by the like's `createdAt asc`. It never answers a like of another product, and it answers an empty array for a product the caller has liked nothing in, without a `404`. While that read is in flight, or after it failed, every like control renders unpressed and enabled with no busy state of its own: a press stays safe because the `PUT` is idempotent, the answered `liked` and `likeCount` correct the row, and the failed read raises no toast of its own. The reviews list body carries no per caller field, so it stays identical for every reader (spec 0012, AC-12 unchanged).
- **AC-4**: `PUT /api/reviews/:reviewId/like` creates one like for the caller and answers `200 { liked: true, likeCount }`, where `likeCount` is read in the same transaction that wrote the row. It is idempotent through `createMany({ skipDuplicates: true })`: a second `PUT` answers the same `200` with the same number and creates no second row and no second increment. `DELETE /api/reviews/:reviewId/like` answers `200 { liked: false, likeCount }`, removes the row through `deleteMany` and decrements only when that call removed exactly one row, so a repeat answers the same shape with the same number and never a negative count. Neither route throws on a duplicate: the unique index `reviewId + userId` is the guard, and no `P2002` reaches the error handler.
- **AC-5**: Both like routes and every comment write sit behind `requireActiveAccount`, so a `PENDING` account answers `403 EMAIL_NOT_CONFIRMED`, an unreadable status answers `503 ACCOUNT_STATUS_UNAVAILABLE`, and a session whose user row is gone answers `401 SESSION_REVOKED`, all three from the existing middleware and none of them re implemented. A missing review answers `404 REVIEW_NOT_FOUND` on every like and comment route. A review whose `status` is not `APPROVED` answers `404` on the like `PUT` and on the comment `GET` and `POST`; both `DELETE` routes act on existence alone, whatever the status, so a like or a comment given before a status change can still be withdrawn instead of sticking forever. The `403 EMAIL_NOT_CONFIRMED` toast comes from the `useFetcher` interceptor, which holds the only `handleRefusal` (it is module private), so the card's branch on that code raises no second toast and only re reads the liked set; any other failure raises `reviews.likeFailed`.
- **AC-6**: A like press is optimistic and single flight. The pressed state and the number change before the answer, and one press sends exactly one request: while that review's request is in flight a second press on the same review returns without sending, while a press on another review is independent. On success the answered `likeCount` replaces the optimistic number. On failure both return to exactly what they were, the `reviews.likeFailed` toast is raised unless the refusal is the confirmation branch of AC-5, and the liked set is re read. The control stays enabled and focusable while its own request runs, so a keyboard user keeps focus where they pressed; it carries `aria-busy="true"` for that interval, and the handler's early return is what stops the second send. The number a row prints is the row's `likeCount` until this customer presses that row's control, then the answered value for the rest of the visit: the feature hook `Reviews/hooks/useReviewCounts.ts` owns one override map per number keyed by review id (S2 allows state in a feature's own `hooks/` and forbids it in `index.tsx`, which stays composition only), so a row from an appended page moves too, and the card renders from that hook rather than from a private copy of the row.
- **AC-7**: `GET /api/reviews/:reviewId/comments` answers `{ comments, nextCursor, hasNextPage }`, oldest first, ordered by `createdAt asc, id asc`, with `limit` an integer clamped to 1 through 50 and defaulting to 10 and a value that is not a number answering `400 REVIEW_INVALID_PAGINATION`. The page is read as `limit + 1` rows, the extra row is dropped, and `hasNextPage` is true only when it existed. `after` must be an id of a comment of this review, and anything else answers `400 REVIEW_INVALID_CURSOR` rather than a page that looks finished. Each row carries `id`, `authorName`, `body`, `createdAt`, `deletedAt` and `mine`, and never `userId`. `authorName` follows the review rule (`User.nickName` trimmed, `null` when empty). A row with `deletedAt` set answers `body: null` and `authorName: null`, so a deleted text never reaches a browser. `nextCursor` is `null` when `hasNextPage` is false. A review that is missing or not `APPROVED` answers `404 REVIEW_NOT_FOUND`.
- **AC-8**: `POST /api/reviews/:reviewId/comments` takes `{ body }`, trims it before validation and before the write, and accepts 5 to 2000 UTF-16 units after the trim, the same rule and the same two constants the review text uses. A shorter or longer body answers `400` with the validation `errors` array naming `body`. The response is `201 { comment, commentCount }`, where `comment` is the same serializer a list row passes through (with `mine: true`) and `commentCount` is read in the transaction that inserted the row, so a failed insert leaves the counter untouched.
- **AC-9**: The comment rate limit is ten rows per account in a rolling hour, counted over `ReviewComment` rows whose `createdAt` is at or after `now - 1 hour` for the caller, deleted rows included, so deleting does not refund the budget. The count and the insert run in one transaction, the eleventh comment in the window answers `429 REVIEW_COMMENT_RATE_LIMITED`, and two simultaneous requests may admit one extra row, which this criterion accepts. The client raises `reviews.comments.refused.rateLimited` and keeps the typed text.
- **AC-10**: `DELETE /api/reviews/:reviewId/comments/:commentId` sets `deletedAt` and decrements `commentCount` in one transaction, and answers `200 { comment, commentCount }`, where `comment` is the row after the delete through the same serializer a list row passes through (`body: null`, `authorName: null`, `deletedAt` set, `mine: true`), so the client writes the stub it was handed instead of inventing one. It is idempotent: a repeat answers the same shape with the same `commentCount` and an identical `comment` row, because the update is guarded by `deletedAt: null` through `updateMany` and only one row counts. Deleting another customer's comment answers `403 REVIEW_COMMENT_FORBIDDEN`, and a comment that does not exist or belongs to another review answers `404 REVIEW_COMMENT_NOT_FOUND`. Both codes are new entries in `REVIEW_ERROR_CODES`.
- **AC-11**: The thread renders under its card. The comment control toggles it through `aria-expanded` (the region unmounts when closed, so a closed thread sends no request). The first page asks for 10 comments. `hasNextPage` renders a control that appends the next page below the current one without repeating an id, and it disappears on the last page. A review with no comments renders `reviews.comments.empty`. A failed read renders `reviews.comments.loadFailed` with a retry control, and the toast is raised from a handler or an effect, never a render body. A deleted comment renders `reviews.comments.deleted` from the row the `200` answered, with no author and no delete control. A comment this customer just created is held in a separate list rendered below the last loaded page and dropped by id when an appended page brings it, because the thread pages oldest first and the new row is not provably last while pages remain unloaded; a `201` raises `reviews.comments.saved`. The form sits at the bottom of the open thread: a textarea whose accessible name is `reviews.comments.label`, rendered as its `<label>`, with `reviews.comments.placeholder` as the hint; a submit control disabled while the body is shorter than 5 or longer than 2000 after trim, and a submit control disabled with `reviews.comments.busy` while the request runs, whose handler returns before sending again, so a repeated press sends no second request. Only a row with `mine` true and no `deletedAt` renders the delete control, which opens the project's `AlertDialog` (`src/components/ui/alert-dialog.tsx`, the primitive the cart line, the order cancel and the account delete already use) with initial focus on the keep control, and sends nothing when the customer keeps. Confirming replaces that row with the stub, so on close the dialog moves focus to the stub, which carries `tabIndex={-1}` and a ref, instead of handing focus back to a detached node; a failed delete raises `reviews.comments.deleteFailed` and leaves the row as it was.
- **AC-12**: Creating or deleting a comment moves the card's comment number to the answered `commentCount` without a reload, through the same `useReviewCounts` map AC-6 names, so the number on the control and the rows inside the thread agree. The thread prints no second number of its own.
- **AC-13**: Every new string exists in `apps/customer/messages/en.json` and `apps/customer/messages/ru.json` under `reviews`, with the same keys: `unlike`, `likeFailed`, and `comments.{open,label,title,empty,deleted,placeholder,submit,busy,saved,loadMore,loadFailed,retry,delete,deleteTitle,deleteText,deleteConfirm,keep,deleteFailed}` plus `comments.refused.{invalid,generic,rateLimited,unconfirmed}`. `like` and `unlike` are the like control's accessible names and read as actions in both catalogs: the Russian `like` changes from the noun `Полезный отзыв` to an action, because a number now sits beside it and a noun would read as a label with a count glued on, and `unlike` is the pressed state of the same control. `comingSoon` and `viewComments` are deleted from both catalogs. No localized string comes from the server, and the two catalogs carry the same key set.
- **AC-14**: The storefront follows the standard it wrote down (`apps/customer/AGENTS.md`, S1 to S5): the new pieces are `Reviews/components/ReviewLikeButton/`, `Reviews/components/ReviewCommentsThread/`, `Reviews/components/ReviewCommentItem/`, `Reviews/components/ReviewCommentForm/` and `Reviews/components/DeleteReviewCommentDialog/`, each a PascalCase folder with `index.tsx`; the pure tables (the comment refusal map, the comment keys) live in `Reviews/lib/`; the two count override maps live in the feature hook `Reviews/hooks/useReviewCounts.ts`, because S2 allows a feature its own `hooks/` and forbids state in `index.tsx`; the four data hooks are `src/hooks/review/useReviewLikes.ts`, `useReviewComments.ts`, `useCreateReviewComment.ts` and `useDeleteReviewComment.ts`; `@/` imports, no `console`, dates through `useFormatter`, no toast from a render body.
- **AC-15**: The behaviour is locked by tests that fail without it. Gateway (jest): a first like answers `200` and increments once; a second `PUT` answers the same number with one row; an unlike decrements once and a second `DELETE` changes nothing; the counter equals the child row count after mixed presses; a like on a review that is not `APPROVED` answers `404`; the liked set answers only this product's approved rows; a comment page orders by `createdAt, id`, drops the extra row, clamps `limit` and refuses a foreign `after`; a deleted row answers `body: null` and `authorName: null`; `mine` is true only for the author; the eleventh comment in the window answers `429`; a comment insert that fails leaves `commentCount` unchanged; a foreign delete answers `403`, and a repeat answers the identical stub row with the same `commentCount`; a missing body answers `400` with `errors` naming `body`; both the `201` and a list row pass through the same serializer. Storefront (vitest): an optimistic like followed by a refusal restores the number and the pressed state; a press on a row from an appended page moves that row's number; a second press while the request runs sends nothing; the comment refusal table maps all four branches; the thread appends without a repeat; the deleted stub renders no author and no delete control; the form refuses 4 and 2001 characters and sends once per press; the delete dialog keeps its keep control focused and leaves focus on the stub after confirming. `pnpm --filter @astrum/api test`, `pnpm --filter @astrum/customer test`, `pnpm --filter @astrum/customer lint` and `pnpm check-types` pass.

## Decision

**Chosen option**: Option 1: two new tables, stored counters, and the two controls finished in place.

Add `ReviewLike` and `ReviewComment`, add `likeCount` and `commentCount` to `Review`, read the caller's liked set from its own route so the shared list stays cacheable, write both counters inside the transaction that writes the row, and replace the two disabled controls with a button, a thread and a form.

**Implementation skills**: none installed that shape this decision; `apps/customer/AGENTS.md` (its `## Coding standard`, S1 to S5) and `apps/customer/CODE_REVIEW.md` govern the storefront part and were followed.

## Rationale

Reasoning, options and the measured state before the decision: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| Entity | Field | Use in this decision |
|---|---|---|
| `ReviewLike` (new) | `id`, `reviewId`, `userId`, `createdAt` | One row per review and customer. `@@unique([reviewId, userId])` is the concurrency guard for the toggle; `@@index([userId])` serves the liked set. Both relations carry `onDelete: Cascade`. |
| `ReviewComment` (new) | `id`, `reviewId`, `userId`, `body`, `createdAt`, `deletedAt DateTime?` | One flat thread per review. `deletedAt` is the soft delete marker; `body` stays in the row so the text is never sent again, only read for the audit of the shop. `@@index([reviewId, createdAt])` serves the thread page, `@@index([userId, createdAt])` serves the hourly count. Both relations carry `onDelete: Cascade`. |
| `Review` (changed) | `likeCount Int @default(0)`, `commentCount Int @default(0)` | The two printed numbers. Written only by the paths this spec defines, always in the transaction that writes the child row. |
| `User` (changed) | `reviewLikes ReviewLike[]`, `reviewComments ReviewComment[]` | The back relations the cascade needs. |

No `parentId`: the thread is flat by the owner's call, so a reply to a reply is just another row.

**State transitions**:

- `ReviewLike`: absent, then present (a `PUT`), then absent (a `DELETE`). Both transitions are idempotent, so the state the client shows survives a repeated press.
- `ReviewComment`: absent, then present (`deletedAt` null), then deleted (`deletedAt` set). There is no path back, no edit and no purge.
- `Review.likeCount` and `Review.commentCount` move only with those transitions, and `commentCount` counts live rows only, so it is always lower than or equal to the number of `ReviewComment` rows of that review once a delete happened.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/products/:productId/review-likes` | GET | none | `{ reviewIds: string[] }` | session cookie | none, an empty array covers every case |
| `/api/reviews/:reviewId/like` | PUT | none | `{ liked: true, likeCount }` | session cookie, `requireActiveAccount` | `404 REVIEW_NOT_FOUND`, `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE` |
| `/api/reviews/:reviewId/like` | DELETE | none | `{ liked: false, likeCount }` | session cookie, `requireActiveAccount` | `404 REVIEW_NOT_FOUND` (a missing review only), `403 EMAIL_NOT_CONFIRMED`, `503 ACCOUNT_STATUS_UNAVAILABLE` |
| `/api/reviews/:reviewId/comments` | GET | `after` (comment id of this review, optional), `limit` (1 to 50, default 10) | `{ comments[], nextCursor, hasNextPage }` | session cookie | `404 REVIEW_NOT_FOUND`, `400 REVIEW_INVALID_PAGINATION`, `400 REVIEW_INVALID_CURSOR` |
| `/api/reviews/:reviewId/comments` | POST | `body` (5 to 2000 after trim) | `201 { comment, commentCount }` | session cookie, `requireActiveAccount` | `404 REVIEW_NOT_FOUND`, `400` validation `errors`, `429 REVIEW_COMMENT_RATE_LIMITED`, `403 EMAIL_NOT_CONFIRMED` |
| `/api/reviews/:reviewId/comments/:commentId` | DELETE | none | `{ comment, commentCount }` | session cookie, `requireActiveAccount` | `404 REVIEW_NOT_FOUND` (a missing review only), `404 REVIEW_COMMENT_NOT_FOUND`, `403 REVIEW_COMMENT_FORBIDDEN`, `403 EMAIL_NOT_CONFIRMED` |

The mount chain is the existing one and it is not duplicated: `app.ts` mounts `reviewsRouter` at `/api/reviews` behind `authenticateToken`, and `product.routes.ts` mounts a second reviews router at `/:productId/reviews` with `mergeParams: true`. The liked set route goes into `product.routes.ts` as `productRoutes.use("/:productId/review-likes", productReviewLikesRouter)`, where `productReviewLikesRouter` is a `Router({ mergeParams: true })` exported from `reviews.routes.ts` that reads `req.params.productId`, so the reviews module keeps ownership of every like and no new hand written `/:productId` route is added beside the existing one.

Every write row in this table also answers `401 SESSION_REVOKED` when the authenticated user row is gone, which is the guard's own first branch; the storefront interceptor already ends the session on that code, so no client branch is added for it.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| liked set | `reviewIds` | `ReviewLike` rows of the caller joined to `Review` where `productId` is the path product and `status = APPROVED`; the caller id comes from the session |
| like toggle | the pressed state of a row | membership in the answered set, never a field of a review row |
| like toggle | `likeCount` in the answer | `Review.likeCount` read inside the transaction, after the conditional increment or decrement |
| like toggle | the number a card prints | the row's `likeCount`, then the answered `likeCount` held in the `useReviewCounts` override map for the rest of the visit |
| like toggle | the request path | `reviewRow.id` from the row the control belongs to |
| like toggle | one request per review | the block's in flight set keyed by review id |
| comment page | `comments[].authorName` | `User.nickName` through the comment's `userId`, trimmed, `null` when empty, and `null` for a deleted row |
| comment page | `comments[].mine` | `comment.userId === req.userId`, computed in the serializer; the id itself never leaves the server |
| comment page | `comments[].deleted` state | `deletedAt` non null |
| comment page | `comments[].body` | the column, or `null` when `deletedAt` is set |
| comment page | `nextCursor`, `hasNextPage` | the `limit + 1` read ordered by `createdAt asc, id asc` |
| comment create | `commentCount` | `Review.commentCount` after the increment, read in the same transaction |
| comment create | the hourly budget | `ReviewComment` rows of the caller with `createdAt >= now - 60 minutes`, counted in the same transaction |
| comment delete | the `comment` row and `commentCount` | the row after `deletedAt` is set, through the shared serializer, and `Review.commentCount` after the decrement, both read in the same transaction |
| card | `commentCount` on the control | the row's `commentCount`, then the answered value from the `useReviewCounts` map |
| thread region | the id `aria-controls` names | `review-<reviewId>-comments`, built on the client from the review id |
| all rows | the printed date | `createdAt` through `useFormatter`, which `src/i18n/request.ts` pins to `timeZone: "UTC"`, so one instant reads the same for every reader; spec 0012 called it the browser zone and the code it shipped prints UTC |

**Key invariants**:

- The unique index `ReviewLike(reviewId, userId)` is the only guard against a double like. The service never reads then writes.
- `Review.likeCount` equals the number of `ReviewLike` rows of that review, and `Review.commentCount` equals the number of its `ReviewComment` rows with `deletedAt` null. Both move inside the transaction that writes the child row, and a refusal rolls that transaction back, so no refusal leaves a counter moved.
- No counter is ever negative: a decrement runs only after the guarded delete or update reported exactly one row.
- The reviews list body stays identical for every reader. No per caller field enters a review row.
- A deleted comment never sends its text, its author or a delete control.
- A comment lives under the review in its path: the review id comes from `req.params.reviewId` and a comment id from another review answers `404`, not a row.

**Security model**:

- The whole storefront sits behind the session guard in `apps/customer/src/proxy.ts`, and every route here sits behind `authenticateToken`, so there is no anonymous surface.
- Likes and comments require an `ACTIVE` account (`requireActiveAccount`): a `PENDING` account reads reviews, comments and counters and is refused on every write with `403 EMAIL_NOT_CONFIRMED`.
- Deleting a comment is the author's alone, enforced by the `userId` in the `updateMany` condition, never by the client hiding a control. A foreign comment answers `403 REVIEW_COMMENT_FORBIDDEN` because the row is read by `id` plus `reviewId` first, so the two refusals stay distinguishable.
- No row publishes a `userId`, an email or an order id. A deleted comment publishes nothing but the fact that it was deleted.
- Moderation is off by the owner's call: every comment is live on write. The hourly limit is per account, so several accounts are not slowed down, and the abuse surface that remains is the one spec 0012 already recorded.

**Configuration required**: none. No new environment variable, no flag, no credential.

**Critical test scenarios**:

- Happy path: a customer likes a review, the number moves at once, a reload shows the same number and the pressed state; the same customer opens the comments, writes one, sees it below the loaded page and the card's comment number moves, verifies **AC-1**, **AC-4**, **AC-6**, **AC-8**, **AC-12**
- Repeat case: a double press on the like control and a repeated `DELETE` after the like is gone both answer the current count and change no row, verifies **AC-4**
- Race case: two `PUT` for the same review and customer in parallel answer two `200` with the same `likeCount`, one row in `ReviewLike`, and the counter equals that row count, verifies **AC-4**
- Limit case: eleven comments in one hour from one account, the eleventh answering `429` with the typed text kept in the form, verifies **AC-9**
- Refusal case: another customer's comment deleted by a forged `DELETE` answers `403`, a comment id from another review answers `404`, a like or a comment on a review that is not `APPROVED` answers `404`, verifies **AC-5**, **AC-7**, **AC-10**
- Deleted case: a deleted comment renders the stub, carries no author and no control, and `commentCount` drops by one while the thread still shows the stub, verifies **AC-7**, **AC-10**, **AC-11**
- Paging case: a review with 25 comments renders 10, appends 10 and 5, drops the control, and repeats no id, verifies **AC-7**, **AC-11**
- Privacy case: the comment page and the liked set carry no `userId` and no email for any row, verifies **AC-3**, **AC-7**

## Migration plan

**Strategy**: no migration plan needed. One additive migration, one deployment, fully revertible by reverting the commit.

**Phases**:
1. `packages/Astrum-db/prisma/schema.prisma` gains the two models, the two back relations on `User` and the two counters on `Review`; the same edit lands in `apps/api-astrum/prisma/schema.prisma` byte for byte and in the trimmed copies of `apps/auth-astrum` and `apps/worker`, because those two also carry `Review` and `User` and a relation to a missing model fails their generate.
2. `pnpm prisma:migrate:dev --name review_likes_and_comments` writes the SQL: two tables with their indexes and cascades, and two `INTEGER NOT NULL DEFAULT 0` columns on `Review`.
3. `pnpm prisma:generate` (turbo, every package with a schema) then `pnpm db:generate` for `@astrum/db`.

**Rollback**: revert the commit and drop the two tables and the two columns in one migration; nothing else reads them, so the reviews block answers exactly what it answered before.

**Risks**: the project runs `migrate` as a one shot service before any app boots, so a required column with a default is safe in one file and every existing review starts at `0`, which is correct because no like or comment row exists at that moment. The risk worth naming is the two counter columns drifting from the child rows if a later write path forgets the transaction; the verify file carries the query that compares them, and Follow-up carries the missing repair job.

## Build plan

Tracer Bullet from the scope header: the thin thread runs from the schema through the gateway to the screen before the next one starts, and the likes thread and the comments thread are two passes of the same shape. The migration is one file for the whole target, because nothing can ship between the tables and the columns.

1. Schema: the two models, the two back relations, the two counters, one migration, the copies in `apps/api-astrum`, `apps/auth-astrum` and `apps/worker`, then `pnpm prisma:generate`. Satisfies **AC-2** (the counters exist), **AC-4**, **AC-8**, **AC-10** (the tables exist).

   — done: the two models and the two counters sit in all four schemas (byte identical for the db and api copies), migration `20261112164114_review_likes_and_comments` is applied, and the tables, both indexes, both cascades and the two default-0 columns were read back from the `astrum-db` container; both clients generated.
2. Gateway likes and the review serializer: `likeCount` and `commentCount` in `reviewRowSelect` and in `PublicReview`, `PUT` and `DELETE /api/reviews/:reviewId/like` through `$transaction` with `createMany({ skipDuplicates: true })` and a guarded `deleteMany`, `productReviewLikesRouter` for the set, the new constants and codes; jest tests for the repeat, the unlike, the counter against the row count and the `404`. Satisfies **AC-2**, **AC-3**, **AC-4**, **AC-5**.

   — done: `PUT`/`DELETE /api/reviews/:reviewId/like`, `GET /api/products/:productId/review-likes` and the counters in `reviewRowSelect`/`serializeReview`; `review-likes.service.spec.ts` (11 tests) and the extended routes spec prove the repeat, the unlike, the counter against the row count and the `404`.
3. Likes on the screen: `likeCount` and `commentCount` on `ProductReview` in `src/common/types/review.types.ts`, which also fixes the one hand written literal in `src/hooks/review/reviewsKeys.test.ts`; `useReviewLikes` (one SWR key per product, the optimistic write, the rollback, the in flight set), `Reviews/hooks/useReviewCounts.ts` (the two override maps, written on the optimistic press and corrected by the answer), `ReviewLikeButton` with its stable accessible name and its `aria-hidden` number, the card wiring, the `unlike` and `likeFailed` copy. Vitest for the optimistic press, the rollback and a press on an appended page. Satisfies **AC-1**, **AC-5**, **AC-6**, **AC-13**.

   — done: `useReviewLikes`, `Reviews/hooks/useReviewCounts.ts`, `ReviewLikeButton`, the card wiring and the `unlike`/`likeFailed` copy; `ReviewCard/index.test.tsx` (7 tests) proves the optimistic press, the rollback after a refusal, one send per press and a press on a row from the appended page.
4. Gateway comments read: `parseLimit` gains a default argument so the thread defaults to 10 while the reviews list keeps 20, the page read, the cursor check, the serializer with `mine` and the deleted row nulling its text and author, the two new codes; jest tests for order, the dropped extra row, the clamped limit, the foreign cursor, the deleted row and `mine`. Satisfies **AC-7**.

   — done: `parseLimit` takes a fallback, the page read, the cursor check and `serializeReviewComment`; the read side of `review-comments.service.spec.ts` (9 tests) covers the order, the dropped extra row, the clamp, the foreign cursor, the deleted row and `mine`.
5. Comments on the screen read side: `useReviewComments` (page one plus appended pages, held in that hook's own state, the retry), `ReviewCommentsThread` and `ReviewCommentItem` with the deleted stub, the load more control and the empty and error states, `aria-controls` and `aria-expanded` on the toggle. Vitest for the append without a repeat and the deleted stub. Satisfies **AC-11**, **AC-7**.

   — done: `useReviewComments`, `mergeCommentPages`, `ReviewCommentsThread` and `ReviewCommentItem` with the stub, the load more control, the empty and error states and `aria-controls`/`aria-expanded`; `commentPages.test.ts` (3) and the item spec (5) pass.
6. Gateway comments write: `CreateReviewCommentDto`, the create path with the hourly count and the insert in one transaction, the soft delete with the author guard and the guarded `updateMany`, `commentCount` in both answers; jest tests for the `429`, the counter after a failed insert, the foreign delete, the repeat and the `400`. Satisfies **AC-8**, **AC-9**, **AC-10**.

   — done: `CreateReviewCommentDto`, the create with the hourly count in the same transaction, the guarded soft delete and `commentCount` in both answers; the write side of `review-comments.service.spec.ts` (8 tests) plus the DTO spec (5) cover the `429`, the untouched counter after a failed insert, the foreign delete, the repeat and the `400`.
7. Comments on the screen write side: `ReviewCommentForm` with the client schema mirroring 5 to 2000 after trim, the single send with its busy state, `useCreateReviewComment`, `useDeleteReviewComment`, `DeleteReviewCommentDialog` on the project's `AlertDialog` with the stub as its focus target, the four refusal branches, the created list held below the loaded pages, the `useReviewCounts` write for the comment number, the `comments` copy in both catalogs. Vitest for the validation edges, one send per press, the refusal table, the dialog's keep control and the focus that lands on the stub. Satisfies **AC-9**, **AC-10**, **AC-11**, **AC-12**, **AC-13**.

   — done: `ReviewCommentForm` on the mirrored schema, `useCreateReviewComment`, `useDeleteReviewComment`, `DeleteReviewCommentDialog` on the project's `AlertDialog`, the four refusal branches and the `comments` copy; the form spec (6) and the item spec prove the validation edges, one send per press, the refusal table, the keep control's focus and the focus that lands on the stub.
8. Locks and cleanup: delete `comingSoon` and `viewComments` from both catalogs and from the card, the parity check between `en.json` and `ru.json`, then `pnpm --filter @astrum/api test`, `pnpm --filter @astrum/customer test`, `pnpm --filter @astrum/customer lint` and `pnpm check-types`. Satisfies **AC-13**, **AC-14**, **AC-15**.

   — done: `comingSoon` and `viewComments` are gone from both catalogs and the card, the `reviews` key sets of `en.json` and `ru.json` match with every key AC-13 lists; `pnpm --filter @astrum/api test` 238 passed, `pnpm --filter @astrum/customer test` 268 passed, `pnpm check-types` 5 of 5 tasks green, and eslint is clean on every touched path (the one repo error sits in the untouched `SellerOrders/index.tsx`).

## Consequences

**Positive**:

- The two controls stop being a promise and start being a feature, and the card's numbers come from rows the server writes.
- The liked set lives on its own route, so the reviews list keeps answering one body for every reader and stays cacheable per product (spec 0012, AC-12 is not weakened).
- The counters are written in the same transaction as the row, so a refusal cannot move a number, and the two repeat paths are idempotent instead of answering a `500`.
- The comment page publishes no `userId`, and a deleted comment's text never leaves the server again.
- One new table pair, no new service, no queue, no flag, no environment variable.

**Negative / tradeoffs**:

- Moderation is still off. The first abusive comment or like stays up, and the only brake is ten comments per account per hour, which does not slow down a person with several accounts.
- The two counters can drift if a later write path forgets the transaction. There is no repair job, only the query in `verify.md`, and spec 0012 already carries three unmaintained counters on `Product` whose fate is still open.
- A deleted comment keeps its row forever and its text stays in the database, so `commentCount` is lower than the row count from the first deletion onward, and no job purges either.
- The number on a card is not live: another customer's like or comment appears only when the block revalidates (SWR on focus), which is the same staleness the reviews list already accepts.
- The product screen makes one more request for the liked set, and each opened thread makes at least one for its first page.
- Unliking deletes the row, so there is no history of who liked what and no way to tell a like that was withdrawn from one that never existed.

**Neutral**:

- `GET /api/reviews/:reviewId` now publishes the two counters with the rest of the raw row. Its shape is not narrowed here; the Follow-up from spec 0012 still applies.
- `ReviewStatus.PENDING` and `REJECTED` stay dead values, and the shop answer table `ReviewResponse` stays unread: the thread shows customer replies only.
- `Review.userId` carries `ON DELETE RESTRICT`, so account deletion already fails for a reviewer and `deleteUser` reports it as "User not found". The new tables cascade, so this decision does not widen that hole, and it does not fix it either.
- One shared helper changes outside the reviews feature: none. The `refusalCode` widening spec 0012 made already covers a `403`.
- Spec 0012 AC-2 ends with a clause saying both controls stay `aria-disabled` with no number beside them. This decision replaces that clause and leaves the rest of spec 0012 untouched, so 0012 remains the record of the read and write path and 0014 owns the two controls.
- The printed dates stay in UTC: `src/i18n/request.ts` pins `timeZone: "UTC"`, so spec 0012's line about the browser zone described an intent the code never carried. This spec names the pinned zone instead of repeating the claim.

## Follow-up

- [ ] Account deletion with a review: `Review.userId` is `ON DELETE RESTRICT`, so `prisma.user.delete` fails for anyone who wrote a review and `deleteUser` answers the misleading "User not found". Its own decision.
- [ ] Shop answers (`ReviewResponse`) stay unbuilt and unread. When they land, the thread has to interleave them with customer replies under one order and one author label.
- [ ] Counter repair: a query that compares `Review.likeCount` and `Review.commentCount` with the child rows, and a decision on whether a job, a constraint or a computed read replaces the stored columns. Until then `verify.md` carries the manual check.
- [ ] A purge for deleted comments: the row and its text stay forever, and nothing deletes them.
- [ ] Moderation before the shop takes strangers (from spec 0012): every comment publishes on write and `PENDING` and `REJECTED` are unreachable.
- [ ] Sorting reviews by likes needs an index on `Review(productId, likeCount)`, and a decision on whether the most liked review outranks the newest.
- [ ] `GET /api/reviews/:reviewId` still answers any customer's raw row, including `userId` and reviews that are not `APPROVED`, and now includes the counters (from spec 0012).
- [ ] A like or comment by an account that deletes itself disappears with the cascade while the review it liked stays, so a review's count can drop without any user action on the review. Acceptable, and worth a line in the agent notes if it ever reads as a bug.
