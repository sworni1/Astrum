# Documentation debt

Found by the documentation sync on 2026-11-12. Every item here is a gap between what a document says and what the repository already does. Nothing on this page changes behaviour: the code is right, the text is behind.

Order is by size of the lie, not by file.

## 1. `docs/DEVELOPMENT.md` drifted from the code

The checklist was written on 2026-11-06 and three slices landed since. These lines are wrong today:

| Line | What it says | What the code shows |
| ---- | ------------ | ------------------- |
| 272 | `[ ]` delivery methods: the table is empty and the ids are hardcoded in `CheckoutForm` | `GET /api/shipping-methods` exists (`apps/api-astrum/src/modules/shipping/shipping.routes.ts:8`), the checkout loads the list, spec 0009 |
| 276 | `[ ]` order access: `getOrdersByUserId` returns no lines and no delivery method | the list returns `orderItemsCount` and the first `previewImage` (fixed 2026-11-11) |
| 277 | `[ ]` delivery is not in the total, the form shows a hardcoded delivery price | the order stores `deliveryPrice` and `grandTotal`, spec 0009 |
| 281 | `[x]` but claims `PATCH /order-items/:id/status` is still missing | the route is mounted at `apps/api-astrum/src/modules/order/seller-order.routes.ts:25` |
| 282 | `[ ]` seller panel: there is no `@astrum/business` application | the panel ships as `apps/customer/src/features/pages/SellerOrders`, spec 0007 |
| 283 | `[ ]` fulfilment: pickup does not exist as a model | `model PickupPoint` in `packages/Astrum-db/prisma/schema.prisma:188`, handover at `seller-order.routes.ts:19`, spec 0013 |
| 289 | `[ ]` reviews: the UI runs on mocks with local state | the block reads the API and writes through `useCreateReview`, spec 0012 |
| 264 | `[x]` with "moderation" as a feature of the reviews API | moderation is off: every review is `APPROVED` on write |
| 300 | Definition of Done 4: the review appears "after moderation" | same as the row above |

Still open and correct: line 292 (no Playwright scenario test) and line 293 (no CI).

**Fix:** one pass over the blockers and the MVP core list, ticked from the code. Keep the honest open items: end to end tests, CI, payment, order letters, courier delivery.

## 2. `docs/changelog/` stops at 2026-11-10

The newest entry is `docs/changelog/2026-11-10-session-cache-unload.md`. Three shipped specs have no entry:

- spec 0011, customer cancel on the order screen (2026-11-11)
- spec 0012, reviews on the product screen (2026-11-11)
- spec 0013, pickup handover (2026-11-12)

The scope ladder never asked for them either: features 6, 7 and 8 in `docs/scope/_root/scope.md` carry no `Document it` row, so the step silently disappeared.

**Fix:** three changelog entries written from the diff and each spec's `verify.md`, then the `Document it` rows added to features 6, 7 and 8 so the next slice keeps the habit.

## 3. Spec 0005 and feature 11 read in progress, but every box is ticked

`docs/specs/_root/0005-account-confirmation-by-email/index.md:5` says `status: In Progress`, and feature 11 in `docs/scope/_root/scope.md` says `in-progress`, while every box of that feature is closed, the review item included.

This one needs the owner, not an edit: the last verify pass left three steps owed, so "done" is his call.

**Fix when he says so:** `status: Accepted` in the spec, `done` in the scope row and in the rollup at `docs/scope/index.md`.
