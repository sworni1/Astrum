# Code quality review: `apps/customer`

Read only pass. No code was changed by this review. Every number below comes from a command run on `dev` at commit `f0b0ddd` (2026-11-11).

## What was measured

| Probe                             | Command                                      | Result                                                   |
| --------------------------------- | -------------------------------------------- | -------------------------------------------------------- |
| Source size                       | `find src -name '*.ts*' \| xargs wc -l`      | 215 files, 15 287 lines (12 826 outside `components/ui`) |
| Lint                              | `pnpm --filter @astrum/customer lint`        | 0 errors, 8 warnings                                     |
| Type gate                         | `pnpm --filter @astrum/customer check-types` | not run in this pass (no code changed)                   |
| `any` / non null assertions       | `grep -rn ': any\|as any'`, `grep ')!'`      | 0 and 0                                                  |
| `console.*`                       | `grep -rn 'console\.'`                       | 19 call sites in 8 files                                 |
| Deep relative imports (4+ levels) | `grep -rn 'from "\.\./\.\./\.\./'`           | 159, against 113 imports through the `@/` alias          |
| TODO / eslint-disable             | `grep -rn 'TODO\|FIXME\|eslint-disable'`     | 2                                                        |
| Test files                        | `find src -name '*.test.ts*'`                | 27 (hooks, seller panel, checkout form, profile, navbar) |

## Verdict

The data and logic layers are healthy. The presentation layer is not: 9 source files above 200 lines carry constants, mapping tables, helpers, state and markup at once, one component is duplicated in two folders, one screen ships hard coded demo data, and one money value is printed with a hard coded `$`. The lint gate passes because it has no rule about file size, function size, nesting or stray `console` calls, so nothing in the pipeline stops the next file from landing the same way.

## Findings

Ordered by cost of leaving them alone. `P0` is a correctness or production data problem, `P1` is structure that keeps spreading, `P2` is polish.

### P0-1. A toast fires during render

`showToast` is a side effect, but four screens call it in the component body instead of in a handler or an effect:

| File                                                                                  | Line | Branch              |
| ------------------------------------------------------------------------------------- | ---- | ------------------- |
| `src/features/pages/Orders/OrderPage/index.tsx`                                       | 139  | `if (error)`        |
| `src/features/pages/Cart/index.tsx`                                                   | 76   | `if (cartError)`    |
| `src/features/pages/ProductOverview/index.tsx`                                        | 35   | `if (productError)` |
| `src/features/general/ProductCard/actions/AddToCartWithQuantity/index.tsx`            | 87   | error branches      |
| `src/features/pages/Cart/components/CartCard/actions/AddToCartWithQuantity/index.tsx` | 76   | error branches      |

React can render the same component twice (Strict Mode, concurrent rendering), and a failed fetch keeps the branch true on every re-render, so the user gets the same toast repeated. The same pattern is what makes `OrderPage` return `null` after warning, leaving a blank screen.

### P0-2. Demo data shipped to production

`src/features/pages/ProductOverview/Reviews/index.tsx` renders four fictional reviews from a module constant `DEMO_REVIEWS` (lines 46 to 91) with avatars from `notion-avatars.netlify.app`, and the product page mounts it unconditionally (`ProductOverview/index.tsx:126`). Every product page shows the same four reviews of products that do not exist. The submit handler validates and then stops, so the form pretends to post a review and discards it.

### P0-3. Money printed outside the money helper

`src/features/pages/Cart/index.tsx` lines 180 and 188 render `$` and `toFixed(2)` directly, while every other screen uses `formatMoney(amount, currency)` (and the same file already adds `totalPrice` from the API elsewhere). A cart in any currency other than USD shows a wrong symbol and no thousands separators.

### P1-1. One file, everything inside

Longest block per file, measured by brace balance:

| File                                                       | Lines | Longest single block                  |
| ---------------------------------------------------------- | ----- | ------------------------------------- |
| `features/pages/Orders/OrderPage/index.tsx`                | 521   | 404 (the component, lines 118 to 521) |
| `features/pages/Cart/components/CheckoutForm/index.tsx`    | 401   | 350                                   |
| `features/pages/ProductOverview/Reviews/index.tsx`         | 383   | 283                                   |
| `components/OptimizedImage.tsx`                            | 376   | 309                                   |
| `features/pages/SellerOnboarding/index.tsx`                | 271   | 192                                   |
| `features/pages/Profile/actions/EditProfileForm/index.tsx` | 257   | 213                                   |

`OrderPage` holds, in one file: three lookup tables (`STATUS_KEYS`, `PAYMENT_KEYS`, `statusOrder`), four helper functions (`getStatusColor`, `getPaymentMethodIcon`, `getStatusSteps`, plus `ICON_SIZE`), two local style constants (`commonCardClass`, `buttonOutlineClass`), the mutate handler, a 340 line JSX tree at nesting depth 14, and two near identical copies of the delivery stepper (mobile lines 344 to 368, desktop lines 371 to 404). `SkeletonPanel`, `LoadingState`, `OutcomeIcon`, `StarRating`, `PriceDisplay` and `ProductName` are extra components defined inside page files, so they cannot be tested or reused.

### P1-2. The same component exists twice

`features/general/ProductCard/actions/AddToCartWithQuantity/index.tsx` (165 lines) and `features/pages/Cart/components/CartCard/actions/AddToCartWithQuantity/index.tsx` (133 lines) are 98 identical lines, 0.66 similarity. Two prop shapes, two `showToast` branches, two error surfaces, one shared job. The cart copy also has an unreachable `useEffect` placement after an early `return`. `ToggleWishlistItemButton` and `RemoveFromCartButton` repeat the same inline toast pattern.

### P1-3. Dead and pointless code

- `OrderPage/index.tsx:79` `getPaymentMethodIcon` has three `case` labels and one `default`, all returning the identical `<CreditCard className="h-5 w-5" />`.
- `OrderPage/index.tsx:63` `getStatusColor` has an unreachable `default` because `OrderStatus` is exhaustive.
- `OrderPage/index.tsx:355` and `388` `!step.active ? "text-white" : ""` adds a class that equals the inherited value.
- `OrderPage/index.tsx:456` the image wrapper carries `group-hover:scale-105` and its child `group-hover:scale-110` at once.
- `ProductCard/index.tsx:73` a commented out prop `// discount, // TODO: Implement discount display`.
- `features/pages/SellerOrders/index.test.tsx` is 478 lines, longer than the component it covers.

### P1-4. DOM surgery inside React

`OrderPage/index.tsx:472` `onError` writes `parent.innerHTML` to swap in a `Package` icon. React does not know about that node, so a later render drops or duplicates it, and the fallback never unmounts. A `useState` flag is the same effect without the desync.

### P1-5. Layout held together by magic numbers

`ProductCard/index.tsx` sets `h-[40px]`, `h-[55px]`, `mb-[-15px]`, `h-[100px]`, `gap-[10px]`, and repeats the clamp twice: `className="line-clamp-2"` plus an inline `style={{ WebkitLineClamp: 2, … }}`. Arbitrary pixel values also appear in `SignIn`, `Register` and both `AddToCartWithQuantity` copies. A card that needs fixed pixel heights to line up will break on the first font scale change and in the second locale.

### P1-6. Lint enforces nothing structural

`apps/customer/eslint.config.mjs` is Next's default plus one downgraded warning. There is no rule for file length, function length, nesting depth, `no-console`, import order, or a ban on deep relative paths. That is why the state above can pass `pnpm lint` with 0 errors, and it is the actual root cause: every refactor below would drift back without the rules.

### P1-7. The formatting gate at the root is broken

`package.json` runs `format:check` as `biome format --check`. Biome is 2.6.4, which removed `--check`:

```
$ npx biome format --check "apps/customer/src/**/*.{ts,tsx}"
Error: `--check` is not expected in this context
```

The flagless `biome format <paths>` is the check in 2.x. In addition, `apps/customer/package.json` carries its own `prettier` script and a `linper` alias, so this package has three formatters configured (biome at the root, prettier per package, eslint-plugin-prettier transitively) and no single owner of the file layout.

### P1-8. Import paths have two dialects

393 imports climb with `../`, 159 of them four or more levels deep (`../../../../../common`), while 113 use the `@/` alias that `tsconfig.json` already defines. The depth is a symptom of the nesting: `features/pages/Cart/components/CartCard/actions/AddToCartWithQuantity/index.tsx` sits five folders deep for one button.

### P2-1. Infrastructure inside a hook file

`hooks/useFetcher.ts` (254 lines) builds the axios instance, installs the interceptors, owns the session end policy, keeps four module level mutable flags (`sessionEnded`, `storeWarningShown`, `confirmationWarningShown`, `activeTranslator`) and re-wraps five thin request methods that only `console.error` and rethrow. The session policy is server boundary logic, not a UI hook; it only lives here because this is where axios is created.

### P2-2. Mixed conventions for the same job

Default export for pages, named export for `CategoryPage`, `StateScreen` and `pageWithLine`, folder named `index.tsx` on one page and `File.tsx` on another, `common/index.ts` re-exporting everything (a barrel that hides cycles). 22 barrels exist while the nested `index.tsx` files also act as barrels.

### P2-3. Doc drift found on the way

`apps/customer/AGENTS.md` says "Backend calls go through a hook in `src/hooks/<domain>`, never inline inside a component". `useFetcher` is imported straight into `common/helpers/session.ts`, and the cart summary computes money inline. The rule exists and is not enforced.

## What is already good, leave it alone

- Data layer: 41 hook files under `src/hooks/<domain>/`, one job each, SWR keys centralised in `common/constants/swr.ts`.
- Validation: every form validates through a zod schema built by a factory that takes the translator (`common/zodSchemes/*.scheme.ts`), so messages are localised instead of hard coded.
- Types: 0 `any`, 0 non null assertions, domain types in `common/types/`.
- Tests: 27 files, and the seller panel shows the target shape for a refactor: `index.tsx` plus `format.ts`, `actionMap.ts`, `refusals.ts`, `pageData.ts`, `grid.ts`, each with its own test.
- i18n: all user facing text goes through `next-intl`; the reviews demo data is the only hard coded copy in the app.
- shadcn primitives in `components/ui/` are vendored and should stay untouched.

## Proposed standard (what the rules should say)

To be written into `apps/customer/AGENTS.md` and enforced by `apps/customer/eslint.config.mjs`:

1. A file is one job, under 200 lines; a component body under 150; JSX nesting at most 6 deep. Past that, extract a named child component into the same folder.
2. A feature folder separates concerns: `index.tsx` (composition only), `components/` (one component per file), `model/` (types, lookup tables, pure helpers, each with a test), `hooks/` (state and side effects). `SellerOrders/` is the reference.
3. No literals in components: status maps, label keys and thresholds live in `model/`, styling variant maps in `class-variance-authority`, user facing text in `messages/*.json`.
4. A pure function that maps data goes to `model/` and gets a unit test; a component test is for behaviour, not for arithmetic.
5. Side effects only in handlers or effects: no `showToast`, no `router.push`, no `document` access in a render body.
6. Money through `formatMoney`, dates through `useFormatter`, never `toFixed`, never a currency symbol in JSX.
7. No `console.*` in `src/` except inside an `ErrorBoundary`; errors surface as a toast plus a state, never a `return null`.
8. Imports always through `@/`; a relative import may not climb more than one level.
9. No fixed pixel sizes for text blocks: use `line-clamp`, `aspect-*` and tokens; `h-[NNpx]` only with a comment saying why.
10. One formatter per package: the root biome owns formatting, `prettier` and the `linper` alias are removed, `format:check` uses the Biome 2 syntax.

## Ranked backlog

| #   | Item                                                                                                                       | Files touched | Effort | Unblocks                     |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------- | ------ | ---------------------------- |
| 1   | Standards in `AGENTS.md` + ESLint limits + fix `format:check`                                                              | 3             | 1.5 h  | Everything below stays fixed |
| 2   | `model/` extraction from `OrderPage` + split into `OrderHeader`, `OrderSummaryCard`, `DeliveryProgress`, `OrderItemsTable` | 6 new         | 2.5 h  | P0-1, P1-1, P1-3, P1-4       |
| 3   | One `AddToCartWithQuantity` in `features/general/`, cart copy deleted                                                      | 3             | 1 h    | P1-2, P0-1                   |
| 4   | `Reviews` split, demo data removed, empty state instead                                                                    | 3             | 1.5 h  | P0-2                         |
| 5   | `CheckoutForm` split into `ShippingSection`, `PaymentSection`, `CheckoutSummary`                                           | 5 new         | 2 h    | P1-1                         |
| 6   | `OptimizedImage` split (download, cache, fallback, presentation)                                                           | 4 new         | 2 h    | P1-1                         |
| 7   | `Cart` summary money through `formatMoney`, selection logic into a hook                                                    | 2             | 45 min | P0-3                         |
| 8   | `SellerOnboarding` and `EditProfileForm` split; error mapping into `model/`                                                | 5 new         | 1.5 h  | P1-1                         |
| 9   | `useFetcher` split: `common/http/client.ts` (axios + interceptors) and a thin `useFetcher`                                 | 3             | 1.5 h  | P2-1                         |
| 10  | `ProductCard` tokens instead of pixel heights, inline style removed                                                        | 2             | 45 min | P1-5                         |

Total: about 15 hours, or 4 sessions of 4 hours. Items 1 to 4 remove 80 percent of the pain.

## Non goals

- No rewrite of `components/ui/` (vendored shadcn).
- No change to the data hooks or the SWR keys.
- No new state library, no React Query migration.
- No test framework change.
