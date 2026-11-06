# 2026-11-06 · English interface by default

Spec: [0006-english-interface-by-default](../specs/_root/0006-english-interface-by-default/index.md).

## Added

- `apps/customer/messages/en.json`, `apps/customer/messages/ru.json` — two catalogs with the
  same key tree in 15 groups (`auth`, `confirmEmail`, `nav`, `footer`, `home`, `catalog`,
  `product`, `cart`, `wishlist`, `orders`, `profile`, `reviews`, `common`, `validation`,
  `notFound`), every interpolation placeholder identical in both.
- `apps/customer/src/i18n/config.ts` — the cookie name, the two locales, the one year
  lifetime, `resolveLocale` (anything outside `en` and `ru` becomes `en`) and a browser side
  cookie reader for the request helpers.
- `apps/customer/src/i18n/request.ts` — next-intl's request config: the locale comes from the
  `NEXT_LOCALE` cookie, the catalogs are a static import map, the time zone is `UTC`. No
  middleware, no routing config, no language segment in any address.
- `apps/customer/src/common/actions/locale.ts` — the `setLocale` server action: it validates
  the value, writes the cookie (`Path=/`, `SameSite=Lax`, one year, not HttpOnly, because a
  language preference is not a secret and the request helpers read it) and revalidates the
  layout.
- `apps/customer/src/components/LocaleSwitcher.tsx` — a native select with an accessible
  label, a transition around the action and a `router.refresh()` after it, so the screen
  already on display repaints.
- `apps/customer/src/global.ts` — the typed message declaration, so a missing key is a type
  error at build time rather than `namespace.key` on screen.
- `apps/customer/src/common/zodSchemes/translator.ts` — the translator type the schema
  factories accept.
- `apps/auth-astrum/src/events/locale.ts`, `apps/api-astrum/src/events/locale.ts` — the
  `Accept-Language` reader: the first tag wins, `ru` is the only other known value, a
  missing or unknown tag means English.
- `apps/worker/src/letters/en.ts`, `apps/worker/src/letters/ru.ts` — the letter copy (subject,
  greeting, intro, action, hint) per language; `apps/worker/src/letter.ts` picks the catalog,
  escapes the link once and builds the plain and the HTML part from the same copy.
- Tests: `apps/customer/src/i18n/config.test.ts` (key tree parity, placeholder parity, no
  Cyrillic in the English catalog, the four resolution cases),
  `apps/customer/src/common/zodSchemes/auth.scheme.test.ts` rebuilt around the per language
  factory, a Russian header case in `apps/auth-astrum/src/auth/auth.controller.spec.ts` and
  `auth.service.spec.ts`, and the letter language cases in `apps/worker/src/letter.test.ts`.
- `docs/specs/_root/0006-english-interface-by-default/{index,rationale,verify}.md` — the spec,
  its reasoning and the 23 verify steps.

## Changed

- `apps/customer/package.json`, `apps/customer/next.config.ts` — `next-intl` 4.14.9 and the
  plugin wrapper around the existing config; the rewrite, the standalone output and the image
  settings are untouched.
- `apps/customer/src/app/layout.tsx` — `NextIntlClientProvider` with the request locale and
  messages, and `<html lang>` taken from `getLocale()` instead of a fixed `"en"`.
- `apps/customer/src/app/(auth)/auth/layout.tsx` — the switcher in the top right corner of
  the sign in, register and confirm email screens.
- The switcher also sits in the desktop navbar and in the mobile menu sheet, so every content
  screen carries it.
- Every storefront screen now reads its copy from the catalog: navbar, mobile sheet, both
  search bars, footer, the confirmation banner, home (hero, promo, recommendations),
  categories and a category, the product page and its gallery, the reviews block, cart, cart
  card, checkout form, orders list, order card, order detail, wishlist, profile and its four
  forms, the 404 screen, the image component and the four shadcn primitives with screen
  reader text (dialog, sheet, pagination, carousel).
- `apps/customer/src/common/zodSchemes/{auth,checkout,edit-password,edit-profile}.scheme.ts`
  — the schemas became factories that take a translator, so validation speaks the chosen
  language; `SignUpCredentials`, `updateUserDto` and `CheckoutFormData` derive from the
  factory return type.
- `apps/customer/src/hooks/useFetcher.ts` — the refusal toasts come from the `errors` group,
  a module level translator holder keeps them current after a switch (with the English
  catalog as the fallback for a toast raised before any screen mounts), and every request
  carries the explicit `Accept-Language` header.
- `apps/customer/src/hooks/user/useResendConfirmation.ts`,
  `apps/customer/src/hooks/auth/useAuth.ts`,
  `apps/customer/src/hooks/order/useCheckout.ts` — the toasts read from the catalog; the
  checkout keeps its server message and falls back to the catalog text.
- `apps/customer/src/common/helpers/confirmEmail.ts` — the resend client sends
  `Accept-Language` too, so the letter follows the page that pressed the button.
- `apps/auth-astrum/src/auth/auth.controller.ts`, `auth.service.ts`,
  `src/events/events.service.ts` — register and resend read the header, pass the language into
  the service and the publisher, and the event body gains `locale` (an added field, not a
  rename, so a message already in flight still delivers as English).
- `apps/api-astrum/src/modules/user/{user.controller,user.service}.ts`,
  `src/events/publisher.ts` — the address change path reads the same header and carries the
  language to the broker.
- `apps/worker/src/consumer.ts` — the event gains a `locale` field, an unknown or missing
  value resolves to English, and the send log line records the language used.
- `apps/customer/src/features/pages/Orders/{OrderCard,OrderPage}`, `Profile/actions/
  EditProfileForm`, `Cart/components/CheckoutForm` — displayed dates go through the next-intl
  formatter (`November 6, 2026` and `6 ноября 2026`), and the order status, payment method and
  line status values are mapped from their enums to catalog keys instead of printing the raw
  value.
- `README.md`, `apps/customer/README.md`, `apps/api-astrum/README.md`,
  `apps/auth-astrum/README.md`, `docs/DEVELOPMENT.md` — rewritten in English. The development
  guide gained an interface language section: where the catalogs live, how a new string is
  added, why a schema is a factory, and how the letter language travels.
- `docs/scope/_root/scope.md` — Slice 7 built, with the four milestone boxes and the code
  pointer; `docs/specs/_root/0006-english-interface-by-default/index.md` moved from
  `Proposed` to `In Progress`.

## Removed

- The Russian toasts and screen text in `apps/customer/src` (thirteen files), the module
  constant `signInFormSchema`, `registerFormSchema`, `checkoutFormSchema`,
  `editPasswordFormSchema` and `editProfileFormSchema`, `dayjs` date formatting in the order
  card, the order page and the profile form, `format` from `date-fns` in the checkout form,
  and `CONFIRMATION_SUBJECT` in the worker.
- The Russian test names in `apps/customer/src/__tests__/healthcheck.test.ts` and
  `apps/customer/src/hooks/order/idempotency.test.ts`. A search for Cyrillic in
  `apps/customer/src` now finds nothing, and the Russian copy lives only in
  `messages/ru.json`.

## Verified

- `pnpm quality-gate` → 18 of 18 tasks, with the type check, lint and tests of every package.
  Customer vitest 18 cases, auth jest 44, api jest 73 with 7 skipped, worker `tsx --test` 26.
  Lint reports 12 warnings (image tags, two React Compiler notes) and no error.
- `pnpm --filter @astrum/customer build` → the storefront compiles and every route stays
  `ƒ` (server rendered on demand), which is what the spec expects once the root layout reads
  a cookie.
- In the running build, with no cookie and any browser language, `/auth/signin` answered in
  English with `<html lang="en">`; choosing Russian turned every visible string over on the
  same screen (`Вход`, `Почта`, `Пароль`, `Войти`, `Нужен аккаунт?`, and the switcher label
  `Язык`); a reload kept `lang="ru"` and the cookie `NEXT_LOCALE=ru`; switching back to
  English turned it all back.
- On `/auth/register` in Russian an invalid email and a 3 character password answered
  `Некорректный адрес почты` and `Пароль должен быть не короче 8 символов` under their
  fields, and the date of birth field kept the `ДД.ММ.ГГГГ` placeholder.
- `/auth/confirm-email` titled itself `Подтверждение почты · Astrum` with `lang="ru"` and
  `Email confirmation · Astrum` with `lang="en"`.
- The standalone bundle carries both catalogs inside the server chunks, so the container
  image needs no extra copy step.

## Open

- The 23 steps in
  [verify.md](../specs/_root/0006-english-interface-by-default/verify.md) are written and not
  run yet; `/check verify english interface by default` is the next step, and the feature
  stays `in-progress` until it passes.
- The cart card still prints the placeholder variant line `"Grey" • 15`. It is fake product
  data rather than copy, so it stayed literal, and it reads the same in both languages until
  the cart carries real variant fields.
- `pnpm add next-intl` ended with `ERR_PNPM_IGNORED_BUILDS` for the `@swc/core` build script.
  The package installed, the tests pass and the build works, but a plain `pnpm install` may
  print the same warning until `"@swc/core": true` joins `allowBuilds` in
  `pnpm-workspace.yaml`.
- `pnpm format` and `pnpm format:check` both fail with biome 2.6.4 (`--ignore-unknown` and
  `--check` are rejected). That predates this change and was left alone, so formatting stays
  manual.
- The Russian catalog needs a native read through before it is treated as final, as the spec
  records.
