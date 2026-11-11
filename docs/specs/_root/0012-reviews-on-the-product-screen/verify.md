# Verify: reviews on the product screen · spec 0012

_Steps derived from spec 0012 acceptance criteria. Every step is written so it can fail; a step that can only pass is not a step. Nothing below has been run yet; `/check verify` runs it against the dev stack (customer on 3000, gateway on 3580, Postgres in the `astrum-db` container, Mailpit on 8025) and rewrites this header with the date and the harness switches it used._

## Premise corrections

- None yet. A premise the run contradicts goes here with the mechanism that proved it, as spec 0011's file does.

## Fixtures the run needs

- Account A, signed in, `ACTIVE`, with a delivered order line for product P and no review on it yet.
- Account A also holding a second delivered line for the same product P, to prove the write control survives one review.
- Account B, signed in, `ACTIVE`, with no order at all.
- Account C, signed in, `PENDING`, with a delivered line for P, to reach the confirmation branch.
- Product P2 that account A never bought.
- Product P0 with no reviews at all, and a review row of P0 seeded so it prints a five row distribution with at least one zero share (for example two rows rated 5 and one rated 3).
- Product P20 with exactly 20 approved reviews, and product P25 with 25, `createdAt` staggered and one pair sharing a `createdAt` to exercise the id tiebreak.
- One approved review carrying two `photos` URLs, and one review whose author left `nickName` empty.
- One delivered line of P flipped to `SHIPPED` in the database for the undelivered branch.

## UI / manual

- [ ] Open the product screen of P → the block lists real reviews with an author name, stars, a date, a comment line and the three detail ratings; the review seeded with `photos` renders both photos with their alt copy → AC-1, AC-2
- [ ] Read the review whose author left `nickName` empty → the author line reads the neutral buyer copy, not an email and not a blank → AC-2
- [ ] Read any review card → no timestamp of an avatar, no like number and no comment number; both controls carry `aria-disabled="true"` and their copy says the feature arrives later → AC-2
- [ ] Read the summary of P0 → the average carries one decimal, the total matches, five rows print integer shares, the row with no reviews prints `0%`, and the shares are not forced to add up to 100 → AC-3
- [ ] Open P25 → 20 cards and one `Показать ещё`; press it → the next page appends below, no card repeats, and the control disappears on the last page → AC-4
- [ ] Open P20 → 20 cards and no `Показать ещё` at all → AC-4, AC-12
- [ ] Open one of the two products an order was created for on the same minute → the appended order shows no duplicate and no gap around the tied `createdAt` → AC-4
- [ ] Open the product screen with the network panel filtered to `reviews` → exactly one request for the first page, not one per consumer → AC-4
- [ ] Read the header rating line → it prints the same average and count as the summary and links to `#reviews`; the view count no longer appears as a review count → AC-5
- [ ] Open P0 → the empty state copy, no invented card, and the write control only when the customer may write → AC-6
- [ ] As account B, open P → no write control and the line explaining that a review needs a delivered order → AC-7
- [ ] As account A, write a review of P, then reopen the screen → no write control and the line saying the review is already written → AC-7, AC-9
- [ ] As account A with the second delivered line, write one review of P, then reopen the screen → the write control is still there, because the second line is still reviewable → AC-7, AC-9
- [ ] Press the write control → a dialog with four star groups and a comment; type four characters in the comment and press submit → nothing leaves the browser, the field shows its message, and the dialog stays open; fill a valid comment and every rating → the request leaves once and the dialog closes → AC-8
- [ ] Confirm the dialog → the success toast appears, the new review stands first, the average and the count move, and the write control is gone without a page reload → AC-9
- [ ] Press submit twice in quick succession on a slow network → one `POST` leaves the browser and the control reports itself busy and disabled during the flight → AC-8
- [ ] With the delivered line of P flipped to `SHIPPED`, write a review → the not delivered toast, the dialog stays open with the typed text, and the network panel shows the list and the product re read after the `403` → AC-10
- [ ] Write the same line twice in two tabs at once → one success toast and one already written toast → AC-10, AC-11
- [ ] Stop the gateway, then submit → the unconfirmed toast, not the generic failure, and the list re reads once the gateway is back → AC-10
- [ ] As account C (`PENDING`), submit → the confirmation toast with the resend action, no second toast, dialog stays open. This is the step that proves the `refusalCode` widening: before it, a `403` reaches no branch at all → AC-10
- [ ] Switch the language to Russian → the dialog, the summary, the empty state, the two blocked lines, the five refusal toasts and the card controls read Russian, and no key is printed raw → AC-13
- [ ] Failed read: fail the reviews request at the transport through CDP `Fetch.failRequest`, reopen the screen → a visible error state with the retry control plus the load failed toast, never an empty screen → AC-6
- [ ] Keyboard only: tab to the write control, open the dialog, tab through the four star groups and the comment, press Escape → focus returns to the write control and no request was sent → AC-8

## Commands

- [ ] `grep -rn "DEMO_REVIEWS\|notion-avatars" apps/customer/src` → no match, and `apps/customer/src/features/pages/ProductOverview/Reviews/lib/reviews.ts` no longer exists → AC-1
- [ ] `curl -s 'http://localhost:3580/api/products/<P>/reviews?limit=2' -H 'Cookie: ***' | jq` → two narrowed rows (no `userId`, no `orderItemId`, no `status`, no `updatedAt`), `aggregate.distribution` carries exactly the keys `"1"` to `"5"`, and the body carries no `reviewState` key at all → AC-12
- [ ] The same call against a product id that exists but whose path segment names a different product: `curl -s 'http://localhost:3580/api/products/<P2>/reviews'` → every returned review has `productId` of P2, and none of P. This is the check that fails on the code before the decision, where the condition was dropped and every product's reviews came back → AC-1, AC-12
- [ ] `curl -s 'http://localhost:3580/api/products/<P>/' | jq '.reviewState'` as account A before writing → `{"status":"ELIGIBLE","orderItemId":"<lineId>"}`; as account B → `{"status":"NOT_PURCHASED","orderItemId":null}`; as account A after writing the only line → `{"status":"ALREADY_REVIEWED","orderItemId":null}` → AC-7
- [ ] The same product call as account A while it still holds two delivered lines of P → `orderItemId` is the line whose order was created last → AC-7
- [ ] `curl -s 'http://localhost:3580/api/products/<P>/reviews?limit=999'` → 50 rows at most; `?limit=abc` → `400` with `"code":"REVIEW_INVALID_PAGINATION"` → AC-12
- [ ] `curl -s 'http://localhost:3580/api/products/<P>/reviews?after=bogus'` → `400` with `"code":"REVIEW_INVALID_CURSOR"`; the same with a valid review id of another product → `400` as well → AC-12
- [ ] `curl -s 'http://localhost:3580/api/products/<P20>/reviews'` → 20 rows, `hasNextPage` false, `nextCursor` null → AC-12, AC-4
- [ ] `curl -i -X POST 'http://localhost:3580/api/products/<P>/reviews' -H 'Content-Type: application/json' -H 'Cookie: ***' -d '{"productId":"<P2>","orderItemId":"<deliveredLineOfP>","rating":5,"qualityRating":5,"deliveryRating":5,"accuracyRating":5,"comment":"fine product"}'` → `201`, and the body's `productId` is P, not P2. The `201` body carries `authorName`, `photos` and `createdAt`, the same fields a list row carries → AC-11
- [ ] The same `POST` repeated → `409` with `"code":"REVIEW_ALREADY_EXISTS"` → AC-11
- [ ] `POST` with an `orderItemId` of account B → `404` with `"code":"REVIEW_ORDER_ITEM_NOT_FOUND"` → AC-11
- [ ] `POST` with the `orderItemId` of P passed on the path of P2 → `403` with `"code":"REVIEW_PRODUCT_MISMATCH"` → AC-11
- [ ] `POST` with an `orderItemId` whose status is `SHIPPED` → `403` with `"code":"REVIEW_ONLY_AFTER_DELIVERY"` → AC-11
- [ ] `POST` with a 2001 character comment and with a 4 character comment → `400` with an `errors` array naming `comment` → AC-11, AC-8
- [ ] `POST` without the cookie → `401` with `"code":"SESSION_MISSING"` → AC-11
- [ ] `curl -i 'http://localhost:3580/api/reviews/<existingReviewId>'` → `200`; the same with an unknown id → `404` with `"code":"REVIEW_NOT_FOUND"`, not a `500` → AC-11
- [ ] `docker exec astrum-db psql -U greedyghoster -d astrum-db -c "SELECT status, rating, \"productId\" FROM \"Review\" ORDER BY \"createdAt\" DESC LIMIT 1;"` → `APPROVED` and the product of the request path → AC-11
- [ ] The same `psql` after the UI write → the row exists with `status = APPROVED`, and `SELECT count(*) FROM "Review" WHERE "orderItemId" = '<line>';` answers 1 → AC-11, AC-9
- [ ] `node -e "<catalog parity check between en.json and ru.json under reviews>"` → `parity ok` → AC-13
- [ ] `node -e "<list the reviews keys of en.json and of ru.json and diff them against the AC-13 key list>"` → the two catalogs match each other and carry every listed key, with `ratingLabel`, `avatarAlt`, `productMissing`, `ratingMissing` and `unlike` absent from both → AC-13
- [ ] `grep -rn "reviewsCount" apps/customer/src/features/pages/ProductOverview apps/customer/messages` → no match on the product screen, so the header reads `reviews.summaryAverage` and `reviews.count` → AC-5, AC-13
- [ ] `grep -rn "impressions" apps/customer/src/features/pages/ProductOverview/index.tsx` → no match → AC-5
- [ ] `grep -rn "mergeParams" apps/api-astrum/src/modules/reviews` → one match on `productReviewsRouter`; `grep -rn "req.params.id" apps/api-astrum/src/modules/reviews` → no match, the controller reads `req.params.productId` → AC-11
- [ ] `grep -rn "new Error(" apps/api-astrum/src/modules/reviews` → no match → AC-11
- [ ] `grep -rn "status !== 401" apps/customer/src/hooks/useFetcher.ts` → no match, so a `403` code reaches `handleRefusal` → AC-10
- [ ] `find apps/customer/src/hooks/review -type f` → `useProductReviews.ts` and `useCreateReview.ts`, and `find apps/customer/src/features/pages/ProductOverview/Reviews -name "*.tsx"` → more than one file, with `index.tsx` holding no `useState` and no handler → AC-14
- [ ] `pnpm --filter @astrum/api test` → the new reviews suites pass → AC-15
- [ ] `pnpm --filter @astrum/customer test` → the schema, refusal table, summary, paging and dialog suites pass → AC-15
- [ ] `pnpm --filter @astrum/customer lint` → no error and no new suppression in `eslint-suppressions.json`; the block's files stay under the 400 code line ceiling → AC-14, AC-15
- [ ] `pnpm check-types` → clean → AC-15

## Run notes

_Empty until `/check verify` runs. Record the account used, the seeded products, how the shipped line and the empty nickname were produced, and every step that had to run through a harness switch (CDP `Fetch.failRequest` for the dropped request, a direct database update for the line status or the nickname) instead of the plain product._
