# Rationale: review likes and comments · spec 0014

## Context

Spec 0012 put the reviews block on real data and closed the write path from a delivered line to the list. It also left two controls on every card visibly disabled, because their backing had no decision: a like needs a row per customer and a number to print, and a comment needs a row, an author, an order and a place to open. The README roadmap carries the same two lines as open, and the scope backlog records them as "needs a decision".

The shop has no moderation and the owner keeps it that way for now, which sets the shape of the whole decision: nothing waits for approval, so the only brake on abuse has to be a rate limit, and the cost of an abusive comment is paid the moment it is written. The reviews table already publishes every row on write for the same reason.

The block is read by signed in customers only (the storefront sits behind a session guard), and the reviews list deliberately answers one body for every reader so it can be cached per product. Any per customer state this decision adds has to sit somewhere else, or that invariant from spec 0012 stops being true.

## Measured state before the decision

Read in the repository on 2026-11-12, before any option was formed:

- `ReviewLike` and `ReviewComment` do not exist. `grep -rn "ReviewLike\|ReviewComment" packages/Astrum-db/prisma apps/api-astrum/src apps/customer/src` matches nothing. `ReviewResponse` exists (a shop answer) and no source file reads or writes it.
- `Review` carries `rating`, the three detail ratings, `comment`, `photos`, `status`, `orderItemId` (unique), `createdAt`, `updatedAt`, and three indexes (`productId + status`, `userId`, `createdAt`). No counter column.
- The card (`apps/customer/src/features/pages/ProductOverview/Reviews/components/ReviewCard/index.tsx`) renders both controls as `Button` with `aria-disabled="true"`, a `ThumbsUp` and a `MessageCircle`, two `sr-only` labels and no number. The comment says so out loud: "the two controls whose feature has not landed yet".
- `reviews.routes.ts` exports two routers: `reviewsRouter` mounted at `/api/reviews` in `app.ts` behind `authenticateToken`, and `productReviewsRouter` mounted at `/:productId/reviews` from `product.routes.ts` with `mergeParams: true`. Both review routes require the session; the `POST` adds `requireActiveAccount`.
- `reviews.service.ts` writes `status: APPROVED` on create, computes the aggregate and the distribution on every read, and hardcodes the page default in `parseLimit` (`REVIEW_PAGE_DEFAULT_LIMIT = 20`).
- The aggregate path is the house style for numbers: `Product.stars`, `Product.reviewCount` and `Product.averageRating` have no writer, `ReviewsService.updateProductAggregates` has no caller, and spec 0012 chose to read the aggregate instead of maintaining those columns. The scope backlog records that debt as still open.
- `Review.userId` is `ON DELETE RESTRICT` (`packages/Astrum-db/prisma/migrations/20260408151426_init/migration.sql:267`), and `UserService.deleteUser` calls `prisma.user.delete` inside a `try` whose `catch` rethrows "User not found". Account deletion therefore already fails for anyone who wrote a review, and reports it as a missing account.
- The schema is carried in four files: `packages/Astrum-db/prisma/schema.prisma` (360 lines, 15 models), `apps/api-astrum/prisma/schema.prisma` (byte identical to it), and `apps/auth-astrum` plus `apps/worker` (342 lines each, identical to each other, equal to the package minus `Business`; both still carry `Review` and `ReviewResponse`, so a relation to a new model must be added there as well or their generate fails).
- The storefront request layer (`src/hooks/useFetcher.ts`) already exposes `getData`, `postItem`, `putItem`, `patchItem` and `deleteItem`, so a `PUT` and a `DELETE` need no new transport.
- `src/components/ui/alert-dialog.tsx` is the destructive confirm primitive in five places (cart line, order cancel, profile edit, sign out, account delete).
- `useProductReviews` is consumed by `ProductOverview/index.tsx` (the header aggregate) and `Reviews/index.tsx`. The storefront review tests mock `next-intl`, `useCreateReview`, `showToast` and `@/components/ui/dialog`.

## Options considered

### Option 1: Finish in place, with stored counters

Two tables, two counter columns on `Review`, four routes on the reviews module, one shared review serializer that gains the two numbers, and the two controls finished on the card with an inline thread.

**Pros**:
- One query reads a page of reviews with its numbers; no aggregate runs per row.
- The counters are a column, so a later sort by popularity is an index and a query, not a rewrite.
- No new service, package, queue or flag; everything sits in the module that already owns reviews.

**Cons**:
- Every write path has to move a counter inside its transaction, and a path that forgets it drifts silently. The project already carries three such columns on `Product` with no writer, so the failure mode is familiar here.
- Two more columns to migrate and a manual repair query instead of a guaranteed number.

### Option 2: Finish in place, with computed counters

The same tables, routes and screen, but the numbers come from `_count` on the relations in the same page read, and `Review` gains no column.

**Pros**:
- A number cannot drift, because no number is stored.
- Follows the style spec 0012 set for the rating aggregate: read it, do not maintain a copy.
- Nothing to backfill, nothing to repair, and a later sort by likes can still count.

**Cons**:
- Every page read carries two aggregates, and the thread header would count again on its own.
- A sort by popularity becomes an aggregate over the whole product, which is the query a stored counter exists to avoid.

### Option 3: A generic reactions table for any content

One `Reaction` row keyed by a target type and a target id, so likes could later attach to anything.

**Pros**:
- One table for likes, comments or votes on any surface.
- No new table per feature.

**Cons**:
- No foreign key to `Review`, so a deleted review leaves orphan rows and the cascade has to be rebuilt by hand.
- Nothing else in this product is likeable, so the generality is paid for now and used never.
- The count per review becomes a string comparison over a type column.

### Option 4: Comments only, likes deferred again

Build the thread and leave the like control disabled one more release.

**Pros**:
- Half the surface, and the comments deliver the discussion the reviews block is missing.
- One table instead of two.

**Cons**:
- The card keeps a disabled control and a "coming soon" line, which is the exact debt that produced this spec.
- The roadmap line would have to be split, and the next decision would reopen the same serializer, the same card and the same copy.

## Sub decisions

**Where the caller's liked state lives.** Three candidates: a `likedByMe` field in every review row, the set inside the product answer beside `reviewState`, or a route of its own per product. The row field was rejected because it makes the list body per customer and retires spec 0012's caching invariant without anything gained: the client needs the same set for every row anyway. The product answer was rejected because it grows an already per customer response and forces a product re read after every like. The route of its own won: one more request per product screen, one key the mutation can write optimistically, and a list that stays identical for every reader. The owner chose it as recommended.

**The like transport.** `PUT` plus `DELETE` on the same path, both idempotent, over a single `POST` toggle. A toggle cannot survive a double press or a retried request: two `POST`s undo each other. Two verbs mean the client states the target state, so a repeat is harmless and the guarded `createMany` and `deleteMany` make the server agree.

**The thread shape.** Flat, by the owner's call. One level of replies was the alternative and it brings a `parentId`, a depth rule, an ordering rule per parent and a UI that indents. The flat thread answers the same question with one query and one list.

**Deletion.** Soft, with `deletedAt`, so the thread keeps its shape and the reply count a reader sees matches the number on the card at the moment of reading. A hard delete was the alternative: one less state, but every deletion silently rewrites a published conversation and the counter can only go down, which looks like a bug from the outside. The cost accepted is that the row and its text stay forever, which is a Follow-up (a purge) rather than an omission.

**Where the thread opens.** Inline under the card, not a dialog and not a page. The card already holds the review, and the discussion is about that review; a dialog would hide the review behind the replies, and a page would need its own route, its own loading state and a back path.

**Stored counters, against my recommendation.** I recommended Option 2 (computed) and the owner chose Option 1 (stored). The recorded reasoning is a page read that carries its numbers without an aggregate per row, and a number a later sort can index. The cost he accepted is real and it is written into the invariants, the migration risks and Follow-up: every write path moves a counter inside one transaction, no refusal may move it, a guarded delete is what keeps it from going negative, and the only repair today is the manual query in `verify.md`. The precedent worth naming: this adds exactly the kind of column the project already carries three of on `Product` with no writer. The difference that makes it defensible is that these two have writers from the first commit, and a test per path asserts the counter equals the child row count.

## Rationale

Option 1 wins on the two forces this decision actually faces: the card needs a number on every page, and the project has no infrastructure for asynchronous repair, so a number that is cheap to read and always written in the same transaction is the shape that survives a Tuesday. Option 2 is the safer default and it was the runner up; it loses only on the second read aggregate and on the popularity sort a shop usually wants next.

Option 3 is over design for a product with one likeable surface and it trades a foreign key for a string, which is the one guarantee this decision cannot give up: a like must disappear with its review and a comment must prove it belongs to the review in the path.

Option 4 was rejected because it would ship the same disabled control one more time, and the whole point of this spec is that the two controls on the card are the last visible "coming soon" in the reviews block.

The liked state lives on its own route because spec 0012 decided the reviews list answers one body for every reader, and reversing a decision that already paid for itself, in order to save one request, is the wrong trade. Deletion is soft because the alternative silently rewrites a conversation that other customers can see.

References: none. The stack is settled, the sources that shaped the decision are the existing specs and the code they describe (0012 for the review contract, the shared serializer, the refusal table and the two disabled controls, 0002 and 0011 for the refusal shape the storefront reads, 0005 for the account gate on writes, 0008 for the one transaction per state change pattern, 0013 for the migration shape and the verify file), and the reasoning stays here rather than in a citation list.
