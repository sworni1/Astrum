# 0010. Storefront coding standard

**Date**: 2026-11-11
**Status**: In Progress

## Summary

The storefront has no written rule for what belongs in a file, so tables, helpers, style constants and markup pile into one component, and helpers with one caller sit in `common`. This decision writes the rule into `apps/customer/AGENTS.md`, adds the review checklist in `apps/customer/CODE_REVIEW.md`, and turns the three parts a machine can check into ESLint errors, with one frozen baseline for the noise that already exists. A reviewer can then reject a file by naming a rule, and new code cannot land the shape the review just measured.

## Decision

**Chosen option**: Option 1, write the standard and enforce the machine checkable part at error with a shrinking baseline.

Five rules, S1 to S5, are copied into `apps/customer/AGENTS.md` under `## Coding standard`, and their review form into `apps/customer/CODE_REVIEW.md`. Three of them are held by ESLint: `max-lines` at 400 code lines as a safety net, `no-console` allowing `console.error`, and `no-restricted-imports` for `../**`. The four `console` sites that already existed live in one `eslint-suppressions.json` that only shrinks, and one codemod sweep rewrote every `../` specifier and every barrel specifier to the module it actually names. The rules that need judgement (where a helper lives, side effects, money, dates, barrels) stay in the checklist, because no installed rule can check them.

**Implementation skills**: none installed that shape this decision; `apps/customer/AGENTS.md` is the authority, and the Next.js rules block it carries (read the bundled docs before writing code) stays in force.

## Standard definition

**Scope**: every file under `apps/customer/src`, except `src/components/ui/**` (vendored shadcn, left untouched). Test files follow every rule except the 400 line safety net of S1. Files outside `src` (`next.config.ts`, `eslint.config.mjs`, `next-env.d.ts`) are outside the standard.

### S1. One file, one job

A file holds one component or one module of pure functions. Everything that can be named and imported on its own lives in its own file: a constant, a lookup table, a label map, a style class constant, a variant map, a pure function, a type used beyond the component's own props, and every child component big enough to deserve a name. A component file keeps markup, its local state, its handlers and the hook calls that feed them. Split the same way inside a file: a function that mixes two jobs (a handler that also formats, a component body that also decides what to render) splits at that boundary. There is no line target to chase, so a coherent 150 line component is not fragmented for a number; the rule is extraction. The safety net: ESLint fails a non test file above 400 lines of code, blank lines and comments not counted.

### S2. Feature folder shape

A feature lives at `src/features/<area>/<Feature>/` and keeps only the folders it needs: `index.tsx` composition, `components/` one component per file, `lib/` constants and pure code, `hooks/` the feature's own state. `index.tsx` imports children, may call the feature's own hooks and a translator, and holds no state, handlers, tables or helpers. A `lib/` file holds lookup tables, pure helpers, style constants and local types, and carries a test when it branches or maps inputs to outputs. A backend call is not a feature hook: it goes through `src/hooks/<domain>`. A component file is `PascalCase.tsx`, a module is `kebab-case.ts`, and `index.tsx` is a feature or folder entry.

### S3. Placement

A constant, a table or a helper with one consumer lives in that feature's `lib/`, never in `src/common/`. `src/common/` holds what two or more features use, or what the cross layer owns: `helpers/`, `types/`, `zodSchemes/`, `constants/`. `src/lib/utils.ts` keeps `cn` because shadcn imports it from there, and no other file joins it. A barrel (`index.ts`) is allowed only as a feature's public surface, and the tree carries none today, so new code and every existing import name the module that exports the symbol: `@/common/helpers/showToast`, not `@/common`.

### S4. Side effects, money and dates

No `showToast`, `router.push`, `document` access or DOM write runs in a render body, and no DOM write behind React runs anywhere, handlers included: a refusal or a failed read surfaces as a toast raised from a handler or an effect plus a rendered state, never a silent `return null`. A user facing amount prints through `formatMoney(amount, currency)` from `src/common/helpers/money.ts`; `toFixed`, a currency symbol in JSX and `getCurrencyEmoji` used as an amount renderer are not amounts. A date shown as content prints through `useFormatter` from next-intl; a date input may use `date-fns` to parse and validate the typed string.

### S5. Imports and one formatter

`@/...` for every import outside the current folder, and `../` never appears: a relative path stays inside the folder (`./money`, `./components/CartCard`); ESLint enforces it. Translation JSON outside `src` is reached through the `@messages/*` alias. Biome 2 formats the root and this package: no package level `prettier`, no `linper` alias and no second formatter config. `pnpm format` runs `biome format --write` and then `biome check --write --only=organizeImports`; `format:check` runs `biome format <globs>` with no `--check` flag, which Biome 2 removed. The pre-commit hook stays `exit 0` on purpose, so formatting is manual.

### Canonical pattern

```tsx
// src/features/pages/Cart/index.tsx: composition only
import { useTranslations } from "next-intl";
import { formatMoney } from "@/common/helpers/money";
import CartCard from "./components/CartCard";
import CheckoutForm from "./components/CheckoutForm";
import { useSelection } from "./hooks/useSelection";

export default function Cart() {
  const t = useTranslations("cart");
  const selection = useSelection();

  return (
    <>
      <CartCard selection={selection} />
      <CheckoutForm selection={selection} title={t("checkout")} />
    </>
  );
}
```

```ts
// src/features/pages/Cart/lib/statusMap.ts: a table owns its own file
export const STATUS_KEYS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
} as const;
```

### Replaces

- Everything in one component file: lookup tables, helpers, style constants, nested components (the `OrderPage` shape).
- Single use helpers parked in `src/common/helpers`.
- `showToast` in a render body, `return null` after warning, and `parent.innerHTML` in a handler.
- `$` and `toFixed` in JSX while `formatMoney` exists, and `getCurrencyEmoji` used as an amount.
- `../../..` imports next to `@/` imports, and imports that name a folder instead of a module.
- Three formatters in one package, and a `format:check` that cannot run.
- Barrels that re export a whole folder so a cycle can hide.

### Enforcement

Three rules and two scoped exceptions in `apps/customer/eslint.config.mjs`:

```js
{
  files: ["src/**/*.{ts,tsx}"],
  ignores: ["src/components/ui/**"],
  linterOptions: { noInlineConfig: true },
  rules: {
    "max-lines": [
      "error",
      { max: 400, skipBlankLines: true, skipComments: true },
    ],
    "no-console": ["error", { allow: ["error"] }],
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: ["../**"], message: "Use the @/ alias outside this folder." },
        ],
      },
    ],
  },
},
{
  files: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  rules: { "max-lines": "off" },
},
```

`no-console` allows `console.error` and nothing else. The shape `["error", { allow: [] }]` is rejected by ESLint 10 (the allow list may not be empty), so it is not used.

What the rules find on today's tree, measured:

| Rule                          | Files | Detail                                                                                                                                  |
| ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `max-lines` (400 code lines)  | 0     | no file exceeds it: `OrderPage/index.tsx` was decomposed before the rules landed                                                    |
| `no-console` (allows `error`) | 4     | `common/helpers/session.ts` (`console.log`), `components/OptimizedImage.tsx`, both `AddToCartWithQuantity` copies (`console.warn` each) |
| `no-restricted-imports`       | 114   | 250 `from` lines plus 23 `vi.mock` specifiers, all rewritten by the codemod before the rule lands                                       |

**Baseline**. From `apps/customer`, `npx eslint . --suppress-rule no-console` writes `eslint-suppressions.json` with four entries, one per file. The file is committed, never gitignored, and counts are per file and per rule, not per site: a file baselined at 2 may hold 2 sites until its entry is pruned. A stale entry fails the run with exit code 2 and the message `There are suppressions left that do not occur anymore`, so the change that fixes a file runs `npx eslint . --prune-suppressions` in the same commit.

**No waivers**. `linterOptions.noInlineConfig` makes every `eslint-disable` comment inert inside `src/`, so a suppressed violation surfaces at its own line instead of hiding. The one comment that exists today, `src/hooks/useFetcher.ts:82` on the deliberate full reload that ends a session, is deleted in rollout step 2; its reason stays in the comment above the line, and the rule it silenced, `@next/next/no-location-assign-relative-destination`, surfaces as a warning that the gate tolerates. A case that genuinely needs a rule turned off changes this standard first.

### Rollout

1. Import codemod, one commit: resolve every specifier against the tree and rewrite it, `../` and barrel paths alike, to the module it names (`@/...` outside the folder, `./...` inside it). It covers `from` clauses, `vi.mock`, `vi.importActual` and dynamic `import()`, leaves `src/components/ui/**` untouched, and aborts with the list of anything it cannot resolve instead of skipping it. Evidence is `pnpm --filter @astrum/customer check-types` and `pnpm --filter @astrum/customer test`, not a line by line read of 114 files. — done: 131 files rewritten (0 unresolved), `check-types` clean, 27 test files and 123 tests pass; barrel mocks in seven test files were repointed at the modules their subject now imports.
2. Rules on: add the block above, generate the four entry baseline with `--suppress-rule no-console`, delete the `eslint-disable` comment at `useFetcher.ts:82`. `pnpm --filter @astrum/customer lint` is green afterwards. — done: 0 errors, 9 warnings (the eight `react-hooks` sites plus the location warning); `eslint-suppressions.json` holds four entries; the disable comment is gone and a probe proved it inert.
3. Documents: copy S1 to S5 into `apps/customer/AGENTS.md` under `## Coding standard`, change its `src/hooks/<domain>/` line from "exported through `index.ts`" to a module import, and write their review form into `apps/customer/CODE_REVIEW.md` with a link from `AGENTS.md`. — done: five `### S<number>.` sections, one `CODE_REVIEW.md` link, ten checklist items; the phrase "exported through" is gone.
4. One formatter: remove `prettier`, `linper` and `@trivago/prettier-plugin-sort-imports` from `apps/customer/package.json`, remove the root `prettier` dependency and `.prettierrc`, point `format` at both commands, fix `format:check`, update the `lint-staged` entry, then run `pnpm format` once and commit its churn on its own. Ten files reorder their imports under `organizeImports` today, so that churn belongs to this commit. — done: `pnpm format` and `pnpm format:check` are green and idempotent, the lockfile diff is nine deletions; 46 files reordered under `organizeImports`, because the codemod rewrote import blocks in more places than the ten measured before it.
5. Scope alignment: row 3 in `docs/scope/customer/scope.md` says the order page maps move into `model/`; it becomes `lib/` in the same change that lands this standard. — done: row 3 and row 9 both say `lib/`, so the two rows match S3.
6. Violations drain through the Slice 2 refactor rows; each row prunes its own baseline entry.

### Exceptions

- `src/components/ui/**` is outside the standard entirely (vendored shadcn).
- Test files are outside S1's 400 line ceiling; every other rule applies to them.
- `max-lines` is off for test files only. The first draft carried a second exception for `Orders/OrderPage/index.tsx`, because a suppression entry counts violations rather than matching them and would have exempted that file forever; the decomposition landed before the rules did, so that exception never had to exist.
- `react-hooks/set-state-in-effect` and `react-hooks/incompatible-library` stay `warn`, eight sites in total. Two are `incompatible-library` on React Hook Form (`CheckoutForm/index.tsx:88`, `EditProfileForm/index.tsx:149`), which the rule cannot satisfy while `react-hook-form` is the form library. Five are `set-state-in-effect` in our own components (both `AddToCartWithQuantity` copies, `ToggleWishlistItemButton`, `ProductGallery`, `SellerOrders`) and one is the vendored carousel. The comment in `eslint.config.mjs` describes these as vendored files; the warning list shows most are ours, so the exception is recorded package wide with its sites named.
- `@next/next/no-location-assign-relative-destination` on `useFetcher.ts:83` stays a warning, unsilenced, after the comment that hid it is removed. Silencing it would need a second config exception, which this standard declines.
- No other exception.

## Consequences

**Positive**:

- A review comment can cite S1 to S5, which is what the scope row asks for ("a reviewer can reject a file by pointing at a rule").
- New code cannot land the shapes the review measured: no new `../` import, no new barrel, no new `console.log` or `console.warn`, no new 400 line file, and no inline suppression at all.
- Three formatters become one, `pnpm format:check` runs again instead of dying on a removed flag, and `pnpm format` orders imports as well as spaces them.
- The import sweep leaves one dialect and one naming rule, so a reader stops switching between `@/`, `../../..` and folder names.

**Negative and tradeoffs**:

- `eslint-suppressions.json` is a new tracked artifact that must be pruned, and its counts are per file, so a fixed site plus a new site in the same file cancels out. Review carries that detail; the checklist names it.
- The 400 line ceiling is a safety net, not a target: a 380 line component passes the gate, so the extraction rule still rests on review. That is the cost of rejecting a 200 line number.
- The plan carried a named exemption for `OrderPage`; the file was decomposed first, so the repository has no file specific exception and the only one left is the test ceiling.
- Removing prettier changes import grouping (the trivago plugin grouped imports), and `organizeImports` reorders ten files at once; that churn belongs to its own commit.
- The codemod touches 114 files and resolves barrels recursively, so its diff is large and is trusted by the type gate and the test run, not by reading every line. A symbol exported by two modules makes the codemod stop rather than guess.
- `src/lib/utils.ts` and a feature `lib/` share a folder name at two levels, because shadcn expects `@/lib/utils`. Renaming `cn` would break every vendored primitive.
- Five of the eight lint warnings sit in our own files, so the recorded exception is broader than vendored code.
- `apps/auth-astrum` keeps prettier until its own change, so "one formatter" is true for the root and the storefront only.

**Neutral**:

- `SellerOrders` keeps its flat modules until that folder is touched.
- `src/common/index.ts` and `src/hooks/index.ts` become unused after the codemod and are deleted in follow-up commits, not in the same sweep.
- The standard covers `apps/customer` only. The gateway and the auth service keep their own conventions until their own decision.

## Follow-up

- [x] Delete `src/common/index.ts`, `src/hooks/index.ts` and the other nested re export files once the codemod has removed their last consumer. — done in the same change: 22 empty barrels removed, `find src -name 'index.ts'` answers 0 outside `components/ui`.
- [x] `getKeyRecommendations.ts` and `getKeyProductsByCategory.ts` move into their consuming hook folders, each has one consumer. — done: both live in `src/hooks/product/useProducts/` beside the hook that uses them, `src/common/helpers` no longer carries them.
- [x] `SellerOrders` flat modules move into `lib/` when that folder is next touched. — done: `actionMap`, `format`, `grid`, `pageData`, `refusals` and their four tests now sit in `src/features/pages/SellerOrders/lib/`; the four importers name the new path.
- [x] One file, one job over the components the rows had not reached: the `ConfirmEmail` view tables and the outcome guard, the `Register` date constants plus the mask and parse helpers, the `OrderCard` status map and variant, the `Reviews` demo table and page size, the `LineActions` dialog copy, and the `OptimizedImage` style maps and blur placeholder each own a module under `lib/`. — done: ten component files lost their tables, `tsc --noEmit` and `tsc -p tsconfig.test.json --noEmit` clean, 147 tests in 33 files still pass.
- [ ] The five `set-state-in-effect` sites belong to the refactor rows that rewrite those files; `react-hook-form` keeps `incompatible-library` at warning until the form library changes.
- [ ] Side effects in a render body: the five `showToast` sites and the `innerHTML` fallback in `OrderPage` are covered by the existing Slice 2 rows, not by this standard.
- [x] The four `getCurrencyEmoji` amount sites and the four remaining `console` calls have no refactor row of their own; fold them into the row that rewrites each file, or open one. — done without a row: `ProductCard`, `ProductOverview` and both `SellerOrderLine` amounts print through `formatMoney(amount, currency)`, so `getCurrencyEmoji` is called only by `money.ts`; both surviving `console` sites (`session.ts`, `OptimizedImage.tsx`) log through `console.error`, the two baseline entries went stale, and `npx eslint . --prune-suppressions` emptied `eslint-suppressions.json` to `{}`.
- [ ] Money and dates are checklist items, not lint rules. A rule for `toFixed`, a currency literal or `getCurrencyEmoji` would need a custom rule, which this repository does not install.
- [ ] File names are mixed today (`itemStatus.ts`, `category.list.ts`, `getCurrencyEmoji.ts`). The standard fixes new files only; existing names change when their file is touched.
- [ ] `apps/auth-astrum` still formats with prettier and reads the root `.prettierrc`; move it to biome when that area gets its own change.
- [ ] A standard for `apps/api-astrum` is its own decision, written when the gateway gets its own review pass.

## Rationale

Reasoning, the options weighed, the cross check that changed three of them, and the measurements behind them: see [rationale.md](rationale.md).
