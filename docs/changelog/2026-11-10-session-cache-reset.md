# 2026-11-10 · Previous account's data after a session change

Found while verifying spec 0008 and recorded in [the plan](../scope/_root/scope.md) instead of a spec: a customer who signed in as a second account in the same tab kept reading the first account on `/profile`, `/orders`, `/cart`, `/wishlist` and in the navbar until a full page reload.

The account data lives in the SWR store, the keys are bare paths (`/users/me`, `/cart`, `/wishlist`, `/orders`) and the store is never dropped when the `__auth` cookie changes, so the second account read the first one's payload. `useUser` made it hold harder still with `keepPreviousData: true`, `revalidateIfStale: false` and a 10 s dedupe window. `next.config.ts` carries no `staleTimes`, and the client router cache was not the cause.

## Fixed

- `apps/customer/src/hooks/useSessionCacheReset.ts`, a new hook over `useSWRConfig().mutate` that drops every key of the store with `mutate(() => true, undefined, { revalidate: false })`. The revalidation is off on purpose: a refetch fired before the cookie settles would refill the store from the account that is leaving.
- `apps/customer/src/hooks/auth/useAuth.ts`: `handleSignIn` now writes the cookie, clears the store, resets the session ended flag, calls `router.refresh()` and then `goNext()`. The success toast and the push to `/` are unchanged. `handleRegister` clears the store too, because it replaces the same cookie.
- `apps/customer/src/hooks/useLogOut.ts`: clears the store before `endSession()`, which revokes the session on the server and redirects to `/auth/signin`.
- No `revalidatePath("/", "layout")` was added. The storefront server reads no account data: `(content)/layout.tsx` only runs `verifySession()` (per request `cache()` around `cookies()`), every page is a client shell and every account payload arrives through SWR, so there is no server cache a path revalidation could drop.

## Tests

- `apps/customer/src/hooks/auth/useAuth.test.tsx` (2), on the real `handleSignIn`: the store is empty after a successful sign in, and the order is `createSession`, `refresh`, `push` with the unchanged toast.
- `apps/customer/src/hooks/useLogOut.test.tsx` (1): `endSession` runs once and the cached cart is gone.
- Both fail with the clear replaced by a no op, so they guard the regression rather than describe it.

## Verified

- Reproduced first on the running stack, two accounts created through `POST /api/auth/register`, confirmed through Mailpit, tokens from `POST /api/auth/signin`, one cart line and one wishlist line on the first account only. With the first token in `__auth` the profile read `Alpha` and the navbar showed two badges; after swapping the cookie to the second token and clicking the cart link (client side, `window.__marker` survived, so no reload) `/cart` still listed `Духовой шкаф Hansa BOES69001`, which belongs to the first account.
- After the fix, the real log out path (the `Log out` button and its confirm, no password typed anywhere): `/profile` as the first account showed `Alpha` and two badges, the log out landed on `/auth/signin` in the same document, and a Back navigation with the second account's cookie rendered `/profile` as `Beta` with the second address and no badge, then `/orders`, `/cart`, `/wishlist` and `/profile` by client side navigation showed no line and no badge of the first account.
- Rendered at 1280×800 and 390×844. Desktop: the profile skeleton while the store is empty (nine placeholders, no account field, no navbar badge), then the loaded profile and an empty cart. Mobile: the profile stacked in one column with no horizontal scroll (`scrollWidth` 390 of 390), the menu sheet reading `Wishlist 1`, `Cart 1`, `Orders`, and the cart page reading `1 item in your cart` with the line and its quantity stepper in place.
- `pnpm quality-gate` on 2026-11-10: 18 of 18 tasks green, 0 errors and the 8 pre-existing lint warnings. Customer: 93 tests in 22 files.

## Open

- The sign in form was never driven in a browser: entering a password into a form is not allowed for this agent. The sign in path is covered by the hook test above, and the same mechanism was proved live through the log out path.
- A manual `__auth` swap from the devtools still shows the previous account, and that is expected: no application code runs on a cookie change, the clear lives in the two hooks. The acceptance check is a real sign in or a real log out.
- `POST /api/auth/register` answers `500` for a date only `dateOfBirth` (`2000-01-01`) while other invalid bodies answer `400`, so an unhandled error sits on the `MinAge` path. Separate defect, not touched here.
- At 390 px the cart card of a `placehold.co` product renders an empty thumbnail box. Pre-existing image handling, unrelated to this change.
