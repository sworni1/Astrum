# Rationale: English interface by default (spec 0006)

## Context

> ⚠️ Premise note: a one time English sweep would answer the complaint for a fraction of this effort. Choosing full localization means every future string opens as two entries, and the Russian catalog goes stale the moment a screen changes without a translation. That is a legitimate trade for a shop with a Russian speaking audience, but it is a standing commitment, not a cleanup. The catalog parity test (AC-6) exists to keep the drift visible, and the native read through in `## Follow-up` is what keeps the Russian copy from reading like a machine.

The storefront speaks two languages at once. Ten files carry Russian toasts and copy (`useFetcher`, `useAuth`, `useResendConfirmation`, the confirm email screen, the resend form, the register screen, the banner, the profile edit form, the product reviews and the confirm email page title), while the rest of the screens are English. The confirmation letter is Russian from subject to footer. The documentation is Russian in most places: 92 of 152 lines of the root README, 180 of 294 lines of `docs/DEVELOPMENT.md`, and parts of the app READMEs. Nobody decided this; it accumulated.

There is no translation layer to build on: `@astrum/customer` has no i18n package, no catalog and no locale anywhere. Every string is a literal inside a component or a hook, and some strings live outside components entirely, in the axios interceptor in `useFetcher`, in the `confirmEmail` helper and in the module level `showToast` calls, which is why a plain "wrap the app in a provider" change is not enough.

The forces at play are specific. The storefront is a Next 16 App Router app whose content pages already render per request because the content layout reads the `__auth` cookie, so dynamic rendering costs nothing new. Every visitor reaches the browser product through `apps/customer`, which talks to the gateway only through the `/api-gateway` rewrite and the `/api/auth` proxy, and the gateway forwards auth requests with `http-proxy-middleware`, which passes request headers through untouched. The confirmation letter is built in `apps/worker` from a `mail.confirmation` event published by the auth service at register and resend, and by the gateway when the address changes. The shop runs as replicas behind Caddy, so any per request state must be shared: a cookie is, a process memory value is not.

If nothing is decided, the mixed interface stays, the next feature adds more literals, and the letter keeps arriving in a language the rest of the shop no longer uses. The scope row for this feature asks for English first and Russian kept as a second language, which sets the bar higher than a sweep.

## Options considered

### Option 1: next-intl with the language in a cookie (chosen)

next-intl version 4 with no language segment in the address. `src/i18n/request.ts` reads a `NEXT_LOCALE` cookie and returns the catalog for it; the root layout wraps the app in `NextIntlClientProvider` and sets `<html lang>`; a server action writes the cookie and revalidates the layout. Components read strings with `useTranslations` (client) or `getTranslations` (server), and dates through `useFormatter`. This is the documented setup for apps that do not need a language in the path (basis: https://next-intl.dev/docs/getting-started/app-router).

**Pros**:

- The file tree stays as it is: no `[locale]` segment, no rewrite of the ten route files, no change to the `proxy.ts` guard, no change to any redirect target.
- Works on the server and in client components, which this storefront needs: most screens are client components with hooks and SWR.
- Typed keys, ICU interpolation and pluralization, and `Intl` date formatting come with the library.
- Peer support for Next 16 and React 19 is declared, and the library's own CI runs Next 16 (basis: https://raw.githubusercontent.com/amannn/next-intl/main/packages/next-intl/package.json).

**Cons**:

- One more dependency in the storefront, with its own upgrades to follow.
- A language in a cookie cannot be linked or shared, and the address never shows the language.
- The library's request config runs per request, so nothing localized can be statically cached (already true here).

### Option 2: next-intl with the language in the address

Every page moves under `app/[locale]/`, the root redirects `/` to `/en`, and the switcher is a plain link. This is the other documented shape (basis: https://next-intl.dev/docs/getting-started/app-router).

**Pros**:

- A Russian page has its own address, so it can be shared, bookmarked and crawled, and the browser back button returns to the previous language.
- Per language caching is possible in principle.

**Cons**:

- Every route file moves, the `proxy.ts` public route list and the sign in redirect have to learn the segment, and every `router.push` target grows a language.
- The whole storefront sits behind a session, so the main benefit, indexable shareable pages, buys almost nothing.
- The diff drowns the actual translation work, which is the part that matters for this feature.

### Option 3: A hand written catalog with a React context

Two JSON files, a small provider that holds the catalog, a `t(key)` helper, and `Intl` calls where dates are shown.

**Pros**:

- No dependency and no new concept: the team can read all of it in ten minutes.
- Perfectly adequate for two languages and a few hundred keys.

**Cons**:

- Pluralization, interpolation, fallback and typed keys are written and maintained by hand, and every one of those is a place to get it subtly wrong.
- Client and server wiring (server actions, server components, the layout) is manual and easy to break.
- The hand written version tends to be replaced later by exactly the library in Option 1, so the work is done twice.

### Option 4: react-i18next as a client runtime

A mature general purpose library, loaded as a client runtime with JSON resources.

**Pros**:

- Very widely used, plenty of examples, and the switching mechanics are well understood.
- Works outside React too, if another surface ever needs it.

**Cons**:

- It is built for client side rendering; in the App Router the server components would need a separate path, and the whole catalog tends to end up in the client bundle.
- Adds more runtime than next-intl for the same result, and no typed key story for this codebase.

## Smaller calls

- **The letter carries its language in the event payload.** The event already travels from the request to the worker, so `locale` rides along and no schema changes (basis: the existing `mail.confirmation` flow in spec 0005). Runner up: a `locale` column on `EmailToken`, which records the choice but costs a migration for a value nothing reads back.
- **The language reaches the services as `Accept-Language`.** It is the standard header for a content negotiation, it is forwarded by the gateway proxy without a change, and it leaves `RegisterUserDto` untouched. That matters because the register service spreads the DTO straight into `prisma.user.create({ data: { ...dto } })`, so an extra DTO field would be handed to Prisma and fail. Runner up: an explicit `locale` field in the two auth DTOs, which needs the same validation and one more shape to keep in sync.
- **The storefront owns all user facing copy.** The gateway keeps answering with codes and English messages, and the storefront maps codes to catalog keys, which it already does for the session and confirmation refusals. Runner up: localized server messages, which would need the catalog in three services and the language on every request.
- **Catalogs live in `apps/customer/messages/` and load through a static import map.** A template literal import path can escape the bundler's tracing in a standalone build, so the request config names both files explicitly. Runner up: a computed import path, shorter to write and riskier to ship.
- **The switcher is a `select` with endonyms** (`English`, `Русский`), labelled from the catalog. Endonyms are what a lost visitor looks for, and a select costs two clicks but stays honest when a third language arrives. Runner up: a two button toggle, fewer clicks and no room to grow.
- **The Russian catalog is complete from the first release.** A Russian mode with half the screens in English is the same mixed experience in the other direction. Runner up: translate only what is Russian today, which is cheaper and visibly broken.
- **Dates keep a fixed typed format and a localized display.** The date of birth field stays `DD.MM.YYYY` with its mask, parser and minimum age rule, while order and profile dates go through the formatter with the browser time zone and a `UTC` server default. Runner up: a locale dependent input format, which rewrites the mask, the parser and the tests for no real gain.
- **No next-intl routing layer at all.** No `middleware.ts`, no `i18n/routing.ts` and no `localePrefix`: with no language segment there is nothing to route, and the routing defaults would add a prefix and read the browser language, which this design refuses. Runner up: the routing setup with `localePrefix: 'never'`, which still adds a middleware pass and a detection step that buys nothing.
- **The switcher repaints explicitly.** The server action writes the cookie; the client then calls `router.refresh()`, because a cookie written in an action does not repaint the screen already on display. Runner up: relying on the revalidation alone, which works or not depending on caching internals and would fail AC-3 silently.
- **The sweep stops at the interface, the letter and the entry documentation.** Changelog files, older specs, Russian code comments and Russian test names are left alone: they are not what a visitor or a new contributor reads first. Runner up: translate everything in the repository, a much larger diff with no user visible effect.

## Rationale

Option 1 wins because of what this storefront already is. Every content page is rendered per request for one session, so the usual argument for a language in the path (caching, static generation) carries no weight here, while the cost of moving ten route files, the guard and every redirect target is real and touches code that has nothing to do with translation. Keeping the address shape also keeps this feature honest: the diff is almost entirely text moving into catalogs, which is what the request was about.

next-intl over a hand written catalog and over react-i18next comes down to where the failure modes live. Two languages, ICU plurals in Russian (three plural forms) and typed keys are exactly the places a hand written helper breaks quietly, and the App Router split between server components, client components and server actions is where a client first runtime gets awkward. next-intl is the small library that already solves those, is maintained against Next 16, and adds one dependency rather than a runtime. The English first rule and the cookie choice from the design conversation settle the rest: no `Accept-Language` detection on the page, one validated value, `en` at every boundary where it is missing or unknown.

The letter language decision follows the same reasoning as the storage decision. Keeping the choice in a cookie means the account holds no language, so the only place that knows the language of the moment is the request that asks for a letter. Carrying it in the event payload puts it exactly where the worker reads it and needs no migration; a column would record a value nothing reads back, and a `User.locale` field would create a second source of truth the cookie can contradict.

## References

### Project sources

- Root `AGENTS.md`: the stack, the fixed layout (`apps/*` runnable, `packages/*` shared), and the rule that the browser talks only to `apps/customer` through `/api-gateway`.
- `apps/customer/AGENTS.md`: Next 16 App Router conventions, the route groups, `src/proxy.ts` as the route guard, and the note that Next 16 differs from older knowledge and ships its own docs.
- `apps/customer/node_modules/next/dist/docs/01-app/02-guides/internationalization.md`: the bundled Next 16 guide for internationalized routing and dictionary loading.
- `docs/specs/_root/0005-account-confirmation-by-email/index.md`: the `mail.confirmation` event, the worker, the letter and the retry ladder this spec extends with a language.
- `docs/specs/_root/0004-session-store-in-redis/index.md`: the `__auth` cookie and the session rules the language cookie must not disturb.
- `docs/scope/_root/scope.md`: feature 12, its intent and its acceptance criteria seeds.
- The code that this spec changes: `apps/customer/src/hooks/useFetcher.ts`, `apps/customer/src/hooks/auth/useAuth.ts`, `apps/customer/src/common/helpers/confirmEmail.ts`, `apps/customer/src/common/zodSchemes/auth.scheme.ts`, `apps/customer/src/app/layout.tsx`, `apps/customer/next.config.ts`, `apps/auth-astrum/src/auth`, `apps/auth-astrum/src/events`, `apps/api-astrum/src/events/publisher.ts`, `apps/api-astrum/src/modules/user/user.service.ts`, `apps/worker/src/letter.ts`, `apps/worker/src/consumer.ts`.

### Practices and standards

- One catalog per language with an identical key tree, checked by a test, so a missing translation fails the build instead of showing a raw key.
- Fall back to the default language at every boundary (page, action, letter) and never let a locale value throw.
- Use HTTP content negotiation (`Accept-Language`) for text the server produces on the customer's behalf, which is what transactional mail is.
- Keep the language out of the address when the application has no public, indexable, per language pages, because a path segment then costs more than it returns.
- Prefer typed message keys so a renamed key fails type checking rather than at runtime.

### Links

- next-intl, App Router setup with a locale from a cookie: https://next-intl.dev/docs/getting-started/app-router
- next-intl, configuration and providers: https://next-intl.dev/docs/usage/configuration
- next-intl, TypeScript message typing: https://next-intl.dev/docs/workflows/typescript
- next-intl, dates and times: https://next-intl.dev/docs/usage/dates-times
- next-intl releases and supported versions: https://github.com/amannn/next-intl/releases
- next-intl peer dependency range (Next `^16`, React `^19`): https://raw.githubusercontent.com/amannn/next-intl/main/packages/next-intl/package.json
- Next.js 16 `proxy.ts` file convention (the renamed middleware): https://nextjs.org/docs/app/api-reference/file-conventions/proxy
