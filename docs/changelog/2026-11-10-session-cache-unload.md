# 2026-11-10 · Skeleton and missing banner after a session switch

Reported after the fix in [the previous entry](2026-11-10-session-cache-reset.md): signing out of a confirmed account and then signing in as an unconfirmed one left `/profile` on the skeleton, with the "confirm your email" banner missing on the content pages. A reload answered both, and it did not happen every time.

The previous fix blanked every key of the SWR store with `mutate(() => true, undefined, { revalidate: false })`. That writes `data: undefined` into every entry and stops there, because it deliberately asks for no revalidation. Two things the entry keeps are what broke the next session:

- **The request markers.** `internalMutate` deletes `FETCH[key]` and `PRELOAD[key]` only in the branch that revalidates, so a finished `/users/me` request stayed registered for the whole `dedupingInterval` of its hook — 10 s in `USER_SWR_CONFIG`. A hook mounted inside that window wants to revalidate (`shouldDoInitialRevalidation` is true while `data` is undefined) but the mount effect skips it at `if (!FETCH[key])`, and the finished request had already written `isLoading: false` / `isValidating: false` into the entry. The page then renders "not loading, no data": the profile skeleton forever, and `profileData?.status !== "PENDING"` in `ConfirmEmailBanner` hides the banner. Whether the window is hit depends on how fast the customer signs in, which is why it was intermittent.
- **The previous payload in `laggyDataRef`.** With `keepPreviousData: true` a hook returns the laggy data while the cache holds none, and only the `UNLOAD_EVENT` drops that ref. A hook that stayed mounted therefore kept rendering the account that had left.

## Fixed

- `apps/customer/src/hooks/useSessionCacheReset.ts` now calls `useSWRConfig().unload({ revalidate })` (SWR 2.5) instead of a key-filtered `mutate`. `unload` deletes every entry — including the `useSWRInfinite` and `useSWRSubscription` keys a filter never matches — deletes every `FETCH`/`PRELOAD` marker, invalidates in-flight mutations, notifies the subscribers of each key and fires `UNLOAD_EVENT`, which is what drops the data kept by `keepPreviousData`.
- `revalidate: false` stays the default: on the log out path a refetch fired before the cookie dies would fill the store from the account that is leaving.
- `handleSignIn` and `handleRegister` (`apps/customer/src/hooks/auth/useAuth.ts`) pass `{ revalidate: true }`, because the cookie already carries the new identity at that point. The auth layout mounts no data hook, so this starts no request on the auth screen; it drops the markers, and the first page of the new session fetches its own payload.
- `apps/customer/src/hooks/useLogOut.ts` no longer awaits the reset, since `unload` is synchronous.

## Tests

- `apps/customer/src/hooks/useSessionCacheReset.test.tsx` (3), built on the real `useUser` with its own 10 s dedupe config and one stable cache provider across a simulated navigation:
  - the first page after a switch reads the new account — before the fix it rendered `{ nick: null, loading: false, calls: 1 }`, one request for two sessions;
  - a mounted hook drops the previous account at once — before the fix it still read `Alpha`;
  - the ending session starts no request and the hook falls to the empty loading state.
- `apps/customer/src/hooks/auth/useAuth.test.tsx` first case changed from "the store is empty after a sign in" to "the previous account is gone and the new one is read" (`Alpha` → `Beta`, two requests): with `revalidate: true` the mounted hook refetches from the new session instead of staying empty.
- All four fail against the previous `mutate`-based reset, so they guard the regression rather than describe it.

## Verified

- Live on the running dev stack (`pnpm dev`, customer 3000, gateway 3580, auth 4580, Mailpit 8025 for the letter), two accounts created through `POST /api/auth/register`: `QaActive` (confirmed through the Mailpit link) and `QaPending` (left unconfirmed). The session switch was driven without the sign in form: log out through the real button and its confirm dialog, then the next account's `__auth` cookie, then `history.back()`. `window.__marker` survived every step, so the document never reloaded and the SWR store was the one the reset had touched.
- Desktop 1280×800, `/profile`: as `QaActive` the form read `QaActive` with 0 skeletons, no banner and 1 `/users/me` request; after the switch the page rendered `QaPending` with 0 skeletons, the amber banner ("Confirm your email qa.after-…pending@example.com. Orders and reviews open once you click the link in the letter.") and 2 `/users/me` requests — the second one fired 292 ms after the back navigation.
- Mobile 390×844, same sequence: `QaPending` with 0 skeletons, banner 113 px tall over three wrapped lines, `scrollWidth` 383 of 390 (no horizontal overflow), 2 `/users/me` requests.
- Control run on the previous implementation (the hook temporarily back on `mutate(() => true, undefined, { revalidate: false })`, same accounts, same clicks, 1280×800): `/profile` after the switch showed 9 skeletons, no nickname, no banner and **1** `/users/me` request — the reported symptom, reproduced end to end in the same document at 7.1 s, inside the 10 s dedupe window. Restoring `unload` returned the run above.
- `pnpm quality-gate` on 2026-11-10: 18 of 18 tasks successful, 0 errors and the same 8 pre-existing lint warnings in the customer package.
- Customer suite: 27 files, 123 tests, green (`npx vitest run` in `apps/customer`).

## Open

- The sign in form itself was never driven in a browser: entering a password into a form is not allowed for this agent. The form's only job at that point is `createSession(token)`, which is exactly what the cookie swap stands in for, and the reset runs on the `handleSignIn` path covered by `hooks/auth/useAuth.test.tsx`.
