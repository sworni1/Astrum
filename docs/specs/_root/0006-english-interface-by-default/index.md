# 0006. English interface by default, with Russian as a second language

**Date**: 2026-11-06
**Status**: In Progress

## Summary

Parts of the storefront answer in Russian today, the confirmation letter is Russian, and most of the README is Russian. This spec makes English what every visitor sees first, keeps Russian as a second language behind a switcher, and adds next-intl (a translation library for Next.js) so no screen carries a literal string any more. The letter follows the language of the page that asked for it, and the documentation is rewritten in English. There is no database change and no language prefix in the address: the choice lives in one cookie.

## Requirements

**User stories**:

- As a visitor, I want to read the whole storefront in one language, so that the shop does not look half translated.
- As a Russian speaking customer, I want to switch the shop to Russian and keep that choice, so that I can use it comfortably.
- As a new customer, I want the confirmation letter in the language I was using, so that I understand what to click.
- As a contributor, I want every string in one catalog per language, so that adding text never means hunting through components.

**Acceptance criteria** (the contract, each one checkable on its own):

- **AC-1**: With no language cookie and any browser language, the first visit shows every screen in English.
- **AC-2**: A missing, empty or unknown language value falls back to English on the server and in the letter, and never produces an error page or a failed delivery.
- **AC-3**: The switcher sits in the navbar on every content screen and on the sign in, register and confirm email screens; choosing Russian re-renders every visible string on the current screen in Russian, and choosing English switches back.
- **AC-4**: The choice survives a reload, a new tab and a new browser session until the cookie expires, and follows a signed in account on that browser.
- **AC-5**: Every user facing string in `apps/customer/src` resolves through the catalog (screens, toasts, empty and error states, button labels, placeholders and page titles), walked screen by screen, and a search for Cyrillic in `apps/customer/src` finds it only in `messages/ru.json`.
- **AC-6**: `messages/en.json` and `messages/ru.json` carry the same key tree and the same interpolation placeholders, and a test fails when they diverge.
- **AC-7**: Form validation speaks the chosen language, including the minimum age rule, the required fields and the date of birth; a typed date stays `DD.MM.YYYY` in both languages, and a birthday under 14 years is still refused with the message under the field.
- **AC-8**: Displayed dates follow the language (`November 6, 2026` and `6 ноября 2026`), while the date of birth input keeps `DD.MM.YYYY` in both.
- **AC-9**: The confirmation letter arrives in the language of the page that asked for it, from registering, from the resend button and from changing the address in the profile.
- **AC-10**: A request without a usable language header gets an English letter, and an unknown language never sends the message to the dead letter queue.
- **AC-11**: The `lang` attribute on the page and the page titles follow the chosen language.
- **AC-12**: The root README, every app README and `docs/DEVELOPMENT.md` read in English.
- **AC-13**: Nothing else changes: routes, the session guard, sign in and sign out, checkout, orders and reviews behave as before, no address gains a language prefix, and `pnpm quality-gate` passes.

## Decision

**Chosen option**: Option 1: next-intl with the language in a cookie and no language segment in the address.

The storefront renders every string through next-intl from two catalogs, `messages/en.json` and `messages/ru.json`; the chosen language lives in a `NEXT_LOCALE` cookie written by a server action; the confirmation letter carries its language in the existing event payload; the documentation is rewritten in English.

The library is next-intl version 4, which declares support for Next 16 and React 19 and documents this exact cookie setup (basis: https://next-intl.dev/docs/getting-started/app-router and https://raw.githubusercontent.com/amannn/next-intl/main/packages/next-intl/package.json). The cookie instead of a language segment follows from the storefront being rendered per request for one session already (basis: `apps/customer/src/app/(content)/layout.tsx` reads the `__auth` cookie), and the letter language follows the event the worker already consumes (basis: spec 0005, the `mail.confirmation` flow).

## Feature design

**Data model sketch**:

No Prisma model and no migration. The feature adds three pieces of state:

- `NEXT_LOCALE` cookie on the storefront origin: value `en` or `ru`, `Path=/`, `SameSite=Lax`, not HttpOnly (a language preference is not a secret and the request helpers read it), `Max-Age` one year. `__auth` keeps its HttpOnly flags untouched.
- `mail.confirmation` event payload: `{ userId, email, requestedAt, locale }` where `locale` is `en` or `ru`. The field is added, not renamed, and a message without it is read as `en`, so anything already in flight still delivers.
- `apps/customer/messages/en.json` and `apps/customer/messages/ru.json`: the same key tree, grouped by feature (`auth`, `confirmEmail`, `nav`, `footer`, `home`, `catalog`, `product`, `cart`, `wishlist`, `orders`, `profile`, `reviews`, `common`, `validation`).
- `apps/worker/src/letters/{en,ru}.ts`: subject, plain part and HTML part for the letter, keyed by the same two values.

**State transitions**: not applicable. The language is a validated value, not a state machine: it is checked when the cookie is written and when it is read, and anything outside `en` and `ru` becomes `en`.

**API surface**:

| Endpoint or action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/auth/register` (proxied by the gateway) | POST | the existing body, plus `Accept-Language: en` or `ru` | `token`, `expiresIn` | public | `403 EMAIL_TAKEN`, `400` validation |
| `/api/auth/confirm/resend` | POST | `email`, plus `Accept-Language` | `204` whatever happens | public | none visible by design |
| `/api/users/me` (address change path) | PATCH | the existing profile body, plus `Accept-Language` | the user | session | `400`, `409 EMAIL_TAKEN` |
| `setLocale(locale)` in `apps/customer/src/common/actions/locale.ts` | server action | `'en'` or `'ru'` | none, writes the cookie and revalidates | works for guests too | an unknown value is ignored |

No new HTTP endpoint, no new URL segment, and the `proxy.ts` matcher keeps its shape. The gateway forwards `/api/auth` with `http-proxy-middleware`, which passes request headers through, so the language reaches the auth service unchanged.

Two mechanics are pinned so the build cannot drift from them:

- The switcher calls `setLocale` inside a transition and then `router.refresh()`. A cookie written by a server action does not by itself repaint the screen already on display, and AC-3 fails without that second call.
- No `middleware.ts`, no `i18n/routing.ts`, no `localePrefix` setting. next-intl's routing layer is exactly what would put a language in the address and start guessing the language from the browser, and both are ruled out here. Resolution lives only in `i18n/request.ts`.

**Value sourcing** (every value each action produces, computes or displays, with its source):

| Action | Value produced or displayed | Source |
|---|---|---|
| any screen | the current language | `NEXT_LOCALE` cookie read in `apps/customer/src/i18n/request.ts`, `en` when missing or unknown |
| any screen | every visible string | `messages/<locale>.json`, resolved by the component through `useTranslations` or `getTranslations` |
| the switcher | the chosen language | the `<select>` value in the client component, validated again in the `setLocale` action |
| the layout and page metadata | `lang` attribute and title | `getLocale()` in the root layout and in `generateMetadata` |
| order and profile dates | the formatted date | the date field from the gateway response, formatted by `useFormatter` with the current language and the browser time zone |
| register, resend, address change | the language of the letter | `Accept-Language` set by the storefront request helpers from `NEXT_LOCALE`, explicitly `en` when the cookie is missing (never the browser default), carried in the event payload to the worker |
| a letter request with no usable header | the letter language | constant `en` |
| README and documentation | English text | static rewrite, no runtime source |

**Key invariants**:

- Both catalogs carry the same keys and the same placeholders at all times; a divergence fails the test suite.
- A language value is `en` or `ru`; anything else becomes `en` and never throws.
- The language cookie is never a security input: the session stays in the HttpOnly `__auth` cookie, and no message key or file path is ever built from a raw header value.
- Server and client render the same language for one request: the cookie is read on the server and handed to the client provider, never read twice with different results.
- Every existing route, redirect and guard keeps its address and its behaviour.
- The storefront never leaves the letter language to the browser: it always sends the language it resolved, `en` included.
- The letter event keeps `userId`, `email` and `requestedAt`; `locale` is additive.

**Security model**:

There is nothing sensitive here. The language cookie is a preference, readable by the storefront scripts on purpose, and carries no identity. The `setLocale` action accepts only the two literals and performs no redirect that a user could steer. The `Accept-Language` header is untrusted input from the internet: it is narrowed to `en` or `ru` before use, and never used to build a path, a query or a message key. The region has no compliance scope (no payment data, no health data, and no new personal data: the language is never stored on the account).

**Configuration required**: none. No new environment variable, no secret and no third party account. The cookie name and the supported languages are constants in the storefront.

**Critical test scenarios** (each maps to an acceptance criterion in `## Requirements`):

- Happy path: a first visit with an empty cookie shows English; the switcher moves the screen to Russian; a reload keeps Russian, verifies **AC-1**, **AC-3**, **AC-4**.
- Failure case: `NEXT_LOCALE=de` and a letter request with `Accept-Language: de` both fall back to English without an error, and a first visit from a Russian browser still asks for an English letter because the helper sends `en` when the cookie is missing, verifies **AC-2**, **AC-10**.
- Parity: a removed key in one catalog fails the suite, and a placeholder that exists in one catalog only fails it too, verifies **AC-6**.
- No hardcoded copy: a search for Cyrillic in `apps/customer/src` finds only `messages/ru.json`, and a screen by screen walk in both languages shows no raw key and no leftover literal, verifies **AC-5**.
- Letter: registering from the Russian interface produces a Russian subject and body, verifies **AC-9**.
- Auth and permissions: a guest switches the language on the sign in screen and the session cookie is untouched; a signed out request to a content route still redirects to sign in, in the current language, verifies **AC-3**, **AC-13**.

## Build plan

Tracer Bullet (the project default): one thin thread runs end to end first (library, request config, provider, cookie action, switcher, one screen fully translated), then the work thickens screen by screen, then the letter path across three services, then the documentation.

1. Add `next-intl` to `@astrum/customer`, wire the plugin in `next.config.ts` (no middleware, no routing config, no language segment), add `apps/customer/src/i18n/request.ts` (cookie read, a static import map for the two catalogs, a `UTC` fallback time zone), add the typed message declaration in `apps/customer/src/global.ts`, and wrap the root layout with `NextIntlClientProvider` plus `<html lang>` from `getLocale()`, satisfies **AC-1**, **AC-2**, **AC-11**
2. Add the `setLocale` server action (validate the value, set the cookie, `revalidatePath("/", "layout")`) and the `<select>` switcher with an accessible label, mounted in the desktop navbar and in `MobileMenuSheet` and in the auth layout; the switcher waits for the action and then calls `router.refresh()` so the current screen repaints, satisfies **AC-3**, **AC-4**
3. Thin thread: move the sign in and register screens onto the catalog, including the messages in `auth.scheme.ts` built per language (which turns `auth.scheme.test.ts` into tests of the per language builder) and the date of birth field, satisfies **AC-5**, **AC-7**
4. Move the confirm email screen, the resend form, the banner and their hooks onto the catalog, and pass a translator into the shared request helpers (`useFetcher`, `confirmEmail`, `useResendConfirmation`) so toasts speak the chosen language, satisfies **AC-5**
5. Fill both catalogs for the content screens (navbar, mobile menu, search placeholder, footer, home, categories, product, cart and checkout, orders, wishlist, profile, reviews, the not found screen, the theme and avatar controls, and the navbar error toasts) and move the displayed dates to the formatter, satisfies **AC-5**, **AC-6**, **AC-8**
6. Add the catalog parity test (same keys, same placeholders) and the language resolution tests (missing, unknown, `en`, `ru`), satisfies **AC-2**, **AC-6**
7. Letter path: set `Accept-Language` from `NEXT_LOCALE` in the storefront request helpers, sending an explicit `en` when the cookie is missing and never the browser default; read it in the auth controller for register and resend, and in `updateUser` of `apps/api-astrum/src/modules/user/user.controller.ts` for the address change, passing it to the service and the publisher; add `locale` to both publishers and to the worker event type, and build the subject and body from a worker catalog with an `en` fallback, satisfies **AC-9**, **AC-10**
8. Localize the metadata: `<html lang>` and the titles from `apps/customer/src/app/layout.tsx` and `apps/customer/src/app/(auth)/auth/confirm-email/page.tsx`, which become `generateMetadata`, satisfies **AC-11**
9. Rewrite the root README, every app README and `docs/DEVELOPMENT.md` in English, satisfies **AC-12**
10. Update the tests that assert copy (at minimum `apps/customer/src/common/zodSchemes/auth.scheme.test.ts` and the health and hook suites that hardcode English text), run `pnpm quality-gate`, and walk every screen in both languages, satisfies **AC-13**

## Consequences

**Positive**:

- One language for the parts that are mixed today, with English as what a stranger sees first.
- Adding a string becomes one catalog entry instead of a literal buried in a component.
- A third language later costs one catalog and one switcher entry, with no change to screens.
- The catalog parity test keeps a half translated screen from shipping silently.
- The letter now speaks the customer's language, which it never did.

**Negative / tradeoffs**:

- Every new string is two entries forever, and the Russian catalog rots the moment someone adds a screen without translating it. The parity test catches a missing key, never a stale translation.
- The client bundle carries the catalog of the active language (tens of kilobytes, not hundreds).
- The letter and the page can disagree: a customer who asked for the letter in Russian and later lands with an English cookie sees an English screen behind a Russian link.
- About thirty components and both request helpers are touched, which is a wide diff for a change that mostly moves text.
- Without a language prefix, a Russian page cannot be linked or shared in Russian, and the browser history does not record the language.
- The Russian text needs a native read through before it can be trusted; machine translated copy in a shop reads badly.

**Neutral**:

- Pages stay dynamic per request, exactly as today, because the session layout already reads a cookie.
- One new dependency (`next-intl`, version 4 line) in `@astrum/customer`; the worker gets a small hand written letter catalog and no dependency.
- The storefront gains `messages/`, `src/i18n/` and `src/global.ts`; the shape of `src/app` does not change.
- No database migration and nothing to roll back on the data side: clearing the cookie returns everyone to English.

## Follow-up

- [ ] Russian code comments and Russian test names (the reviews module and several `*.spec.ts` files) stay as they are; cleaning them up is a separate step.
- [ ] Consider a lint guard that refuses Cyrillic literals in `apps/customer/src`, so a hardcoded string cannot come back unnoticed.
- [ ] `docs/changelog/` and older specs stay in Russian; translate them only if one language across all documents is wanted.
- [ ] The Russian catalog needs a read through by a native speaker before it is treated as final.
- [ ] If the shop later needs shareable Russian links, add a `[locale]` segment; the catalogs and the provider survive that move unchanged.

## Rationale

The reasoning and the options that were weighed: see [rationale.md](rationale.md).
