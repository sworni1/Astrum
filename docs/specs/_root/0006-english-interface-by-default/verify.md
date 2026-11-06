# Verify: English interface by default · spec 0006 · updated 2026-11-06

_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI and manual

- [ ] With no `NEXT_LOCALE` cookie (DevTools, Application, Cookies) and any browser language, open `/auth/signin` → the whole screen is English and `<html lang>` reads `en` → AC-1
- [ ] Set `NEXT_LOCALE=de` by hand and load `/auth/signin`, then set it to an empty value and load again → English both times, no error page → AC-2
- [ ] On `/auth/signin`, `/auth/register`, `/auth/confirm-email` and one content screen, choose Russian in the switcher → every visible string turns Russian on the same screen; choose English → everything turns back → AC-3
- [ ] Reload the page, open a second tab, close and reopen the browser → the choice survives, and the cookie shows `NEXT_LOCALE` with an expiry about one year away → AC-4
- [ ] Walk every screen in both languages: home, categories, one category with a search query, a product, cart, checkout, orders, one order, wishlist, profile, the reviews block and a missing address → no English literal survives in Russian and no raw `namespace.key` renders → AC-5
- [ ] In Russian, submit the register form with an invalid email, a 3 character password, no gender and a date of birth 13 years back → each message is Russian and sits under its field; a typed date stays `ДД.ММ.ГГГГ` → AC-7
- [ ] In Russian, open an order and the profile → dates read `6 ноября 2026`; in English `November 6, 2026`; the date of birth input keeps `DD.MM.YYYY` in both → AC-8
- [ ] Register in Russian, open Mailpit on `:8025` → the letter subject and body are Russian; register in English → English; change the address from the Russian profile and from the Russian resend button → a Russian letter each time → AC-9
- [ ] Publish a hand written `account.confirmation.requested` event with no `locale` and one with `locale: "de"` → both letters are English, and `mail.confirmation.dead` stays empty → AC-10
- [ ] Switch the language and check the page title and `<html lang>` on `/auth/confirm-email` → `Подтверждение почты · Astrum` with `lang="ru"`, and `Email confirmation · Astrum` with `lang="en"` → AC-11
- [ ] Search `apps/customer/src` for `[\u0400-\u04FF]` → no match; the Russian copy lives only in `apps/customer/messages/ru.json` → AC-5
- [ ] Open the root `README.md`, `apps/customer/README.md`, `apps/api-astrum/README.md`, `apps/auth-astrum/README.md` and `docs/DEVELOPMENT.md` → all read in English, with the Russian commit subject examples as the only Russian left → AC-12

## Commands

- [ ] `pnpm --filter @astrum/customer test` → the catalog parity test and the language resolution tests pass → AC-2, AC-6
- [ ] Add a key to `apps/customer/messages/en.json` only, then `pnpm --filter @astrum/customer test` → the parity test fails, and passes again once the key is removed → AC-6
- [ ] `pnpm --filter @astrum/worker test` → the letter suite passes, including the English default and the unknown language fallback → AC-10
- [ ] `pnpm --filter @astrum/auth test` → the controller and service specs pass, including the Russian header case → AC-9
- [ ] `pnpm quality-gate` → green, with routes, the session guard, sign in and sign out unchanged → AC-13
- [ ] `pnpm --filter @astrum/customer build` → every route stays dynamic and the build succeeds → AC-1, AC-13

## Value sourcing

- [ ] With the cookie cleared, reload a content screen → the language comes from the `NEXT_LOCALE` cookie default `en` and every string from `messages/en.json` → AC-1
- [ ] Switch to Russian, then clear the cookie and reload → the screen and the dates come back in English, which proves the cookie is the only source → AC-2, AC-8
- [ ] With `NEXT_LOCALE=ru`, order a letter, then set the cookie to `en` before opening the link → the letter stays Russian while the page is English, the documented tradeoff → AC-9
- [ ] With `NEXT_LOCALE=ru`, open an order → `Order #…` becomes `Заказ #…` and the placed on date uses the Russian month name → AC-8
- [ ] With `NEXT_LOCALE=de`, order a letter → English subject, because an unknown value resolves to English on both the page and the letter → AC-2, AC-10

## Acceptance-criteria coverage

- AC-1 covered by the first visit steps and the build step
- AC-2 covered by the unknown and empty cookie steps, the resolution tests and the letter value sourcing step
- AC-3 covered by the switcher step on the content, auth and confirm screens
- AC-4 covered by the reload, new tab and new browser step
- AC-5 covered by the full screen walk and the Cyrillic search step
- AC-6 covered by the parity test and the deliberate divergence step
- AC-7 covered by the register validation step
- AC-8 covered by the date steps and the order date value sourcing step
- AC-9 covered by the letter steps from register, resend and the address change
- AC-10 covered by the hand written event step and the worker suite
- AC-11 covered by the title and `lang` step
- AC-12 covered by the documentation read step
- AC-13 covered by `pnpm quality-gate` and the build step
