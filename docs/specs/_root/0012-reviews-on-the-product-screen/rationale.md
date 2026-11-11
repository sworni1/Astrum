# Rationale: reviews on the product screen · spec 0012

## Context

> ⚠️ Premise note: the topic reads as a display job ("the block still renders mock reviews"), but the display is the smaller half. Nothing in the repository ever sets a review to `APPROVED`, and the read route answers only `APPROVED` rows, so a review written today is invisible to everyone, including its author, forever. Every refusal in the module is a plain `Error` string such as `"403: Review can only be created for delivered purchases"`, and `handleErrors` answers anything that is not an `AppError` as `500`, so the refusal the storefront would show does not exist yet. The premise also hides a hole: `createReview` proves the purchase against the product in the path and then writes the product from the request body. A client can prove a purchase of product A and land the review on product B. The decision is therefore the whole path, not the block.

The product screen holds a reviews block that was written against invented data: four reviews of products that do not exist, a like count, a comment count, a name and email form whose submit handler validates two fields and returns. The block is the last place on the storefront where the screen shows numbers the shop never produced, next to a product header that prints the view count as a review count and five filled stars whatever the rating is.

The gateway already carries the domain: a `Review` row hangs off one delivered `OrderItem` (unique index), four ratings, a comment, optional photos and a status. Two routes exist, one list under the product and one by id. Nothing else in the repository reads or writes those rows, and no moderation surface moves them out of `PENDING`. So the shop owns a schema with a moderation column that no code ever writes, a computed aggregate method with no caller, and a storefront that shows fiction.

The consequence of not deciding is a storefront that cannot be trusted on the one number a buyer looks for, and a reviews module that answers `500` where it means `403`, which makes every failure look like an outage in the logs.

## Measured state before the decision

Read from the repository on 2026-11-11, not remembered:

| Finding | Where |
|---|---|
| The list answers only `status: APPROVED` | `apps/api-astrum/src/modules/reviews/reviews.service.ts`, `getReviewsForProduct` |
| Nothing in the repository writes `APPROVED`; the create path writes `PENDING` | same file, `createReview`; no other writer exists |
| `updateProductAggregates` has no caller anywhere | same file, line 108, and a grep across `apps` and `packages` |
| Every refusal is a bare `Error` with a status prefix in its text | same file, four sites; `handleErrors` turns non `AppError` into `500` |
| The purchase check uses the path product, the created row uses `dto.productId` | `createReview`, the `purchaseCheck` where clause against the `create` data |
| The list returns raw rows, including `userId`, `orderItemId` and `status` | `getReviewsForProduct`, no `select` |
| `limit` is unclamped (`Number(limit)`) and `nextCursor` is produced whenever the page is full | same file |
| The block holds four invented reviews, invented like and comment counts and page number paging over the array | `apps/customer/src/features/pages/ProductOverview/Reviews/index.tsx` and its `lib/reviews.ts` |
| The header prints `_count.impressions` as the review count and five filled stars | `apps/customer/src/features/pages/ProductOverview/index.tsx` |
| `apps/customer/src/hooks/review/` exists and holds no file | the directory |
| The child router never receives the product id: the parent mounts `/:productId/reviews`, the child `Router()` carries no `mergeParams`, and the controller reads `req.params.id`, so the service has been receiving `undefined` and Prisma has been dropping the condition, which makes the list answer every product's approved reviews | `apps/api-astrum/src/modules/product/product.routes.ts`, `modules/reviews/reviews.routes.ts`, `modules/reviews/reviews.controller.ts` |
| The storefront reads a refusal code only when the answer status is `401`, so the `EMAIL_NOT_CONFIRMED` branch written for a `403` cannot fire | `apps/customer/src/hooks/useFetcher.ts`, `refusalCode` |
| The list orders by `createdAt` alone while the cursor is an id, and `createdAt` is not unique | `getReviewsForProduct` |

## Options considered

### Option 1: Finish the existing module in place and publish on write

Keep both routes, the service and the table. Create the review as `APPROVED`, narrow the read answer to what the screen needs, add the author name, the distribution and the caller's review state to the same answer, translate the refusals to `AppError` codes, and replace the demo block with a feature folder that reads and writes those routes.

**Pros**:

- One owner for the rule (the gateway) and one table, no new surface.
- The customer sees the review they wrote immediately, which is the only outcome that makes the form honest.
- Every other gap in the module (the `500`s, the body product, the raw rows, the unclamped limit) closes in the same pass because the screen now depends on the shape.

**Cons**:

- No moderation, so a hostile review is published at once.
- `PENDING` and `REJECTED` become dead values, and the schema's moderation intent is deferred rather than delivered.

### Option 2: Keep `PENDING` and show the author their own review

Create as `PENDING`, answer the author's own pending review with a "under review" label, and keep everyone else seeing only `APPROVED`.

**Pros**:

- The schema's moderation column keeps its meaning and the shop keeps its gate.
- The author at least sees that the review exists.

**Cons**:

- No moderation surface exists, so the review stays `PENDING` forever unless somebody edits the row by hand: the block would show one author a review that no other customer can ever see, and the average would never move.
- The list response would have to merge two access rules (public rows plus the caller's own), which is a rule with no reader.

### Option 3: Publish everything except `REJECTED`

Change the read filter to `status != REJECTED` and keep writing `PENDING`.

**Pros**:

- One filter change, no writer change.
- A future moderation surface can still reject a row and hide it.

**Cons**:

- The status column then means two different things to two readers (a value nobody moves, and a value that hides), which is how a column stops being trusted.
- The intent is identical to Option 1 while the code claims a gate that does not exist.

### Option 4: A minimal moderation surface now

Add approve and reject routes with a seller or an operator authority, keep `PENDING` on write, and publish only after a decision.

**Pros**:

- The published rating is curated from the first day, which is what a real marketplace does.

**Cons**:

- It needs an authority this project does not have (there is no operator role, only `isSeller`), a screen or a script to use it, and a decision about who answers a rejected review.
- It is a second decision wearing the first one's clothes; the storefront would still have no reviews to show until somebody moderates.

## Rationale

The gateway is the owner of the rule and the client only hints, so every option keeps the single table and the single service. Option 1 wins because the alternative shapes all build a gate the project cannot staff: with no operator role and no moderation screen, `PENDING` is a state that swallows a review permanently, and a block that shows one person a review nobody else can read is worse than the demo it replaces. Publishing on write is the only shape where the form, the list, the average and the count tell the same story on the same request, and the scope row's own promise ("a customer with a delivered line can write one review") is kept without inventing an authority to approve it.

The caller's review state lives in the product answer rather than the list answer, because the product answer is already per customer (`isWishlisted`, `quantityInCart` sit in the same body) and the reviews answer then stays identical for every reader, which is what makes it cacheable per product later. The runner up was to answer it inside the list response, which saves the block one key but puts a per customer field on a route whose whole value is being the same for everybody. The client hint is never the permission either way: the write path proves the purchase again on the server, from the order line, the authenticated user and the product in the path.

The aggregate is computed from the rows rather than read from `Product.reviewCount` and `Product.averageRating`, because no code writes those columns today and wiring them turns every write into a second thing to keep in step. `updateProductAggregates` exists and has no caller; the runner up was to call it inside the create transaction and expose the two columns on the product payload. It was rejected for this decision because it doubles the write path to save a read that the screen already makes.

The header reads the same SWR key as the block on purpose: the aggregate is part of the list answer, so a second source would be a second answer that can disagree, and a denormalized column would be a third.

The dialog carries the four ratings because the DTO requires all four: sending the overall rating four times would fill the detail columns with a number nobody measured, and making them optional needs a migration and a reason. The three detail ratings are shown per review for the same reason they are asked: a value the form collects and the screen never prints is a question that should not have been asked.

The like and comment controls stay, disabled, with the copy that they arrive later, because the counters they had were the last invented numbers in the block and removing the counters removes the lie while the disabled state keeps the layout honest about what the feature will hold. Both controls carry `aria-disabled` rather than the `disabled` attribute so assistive technology announces them and the layout keeps its shape.

References: none. The stack is settled, the sources that shaped the decision are the existing specs and the code they describe (0001 for the product payload, 0002 and 0011 for the refusal shape the storefront reads, 0006 for the English default catalog), and the reasoning stays here rather than in a citation list.
