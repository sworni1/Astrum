# 0010 · Storefront coding standard: decision record

_Context, options, the cross check and the evidence behind [index.md](index.md). `/develop` skips this file._

## Context

> ⚠️ Premise note: a written standard does not fix the ten files that broke it. It changes what the next file may look like and gives the refactor rows a reference. Only three rules are machine checked, and the 400 line ceiling catches the extreme case, so most of this standard rests on someone reading the diff. That is the honest cost of rejecting a numeric target below 400: a standard on paper is worth what the review costs.

The storefront is 215 source files and 15,287 lines, and the data layer is healthy: 41 hook files under `src/hooks/<domain>/`, one job each, SWR keys in one file, every form validated by a zod schema built with the translator, zero `any`, zero non null assertions, 27 test files. The presentation layer is where the code has drifted: 10 files above 200 lines (worst 521), one component duplicated in two folders with 98 identical lines, four hard coded demo reviews shipped to production, `$` and `toFixed` printed in the cart while every other screen goes through `formatMoney`, and 19 `console` calls in 8 files (15 `error`, 3 `warn`, 1 `log`).

`pnpm --filter @astrum/customer lint` reports 0 errors and 8 warnings, and that is the actual problem: the config is Next's default plus one downgraded warning, so no rule measures file size, console use or import depth. Structure can decay without the gate noticing, and every Slice 2 row in `docs/scope/customer/scope.md` would refactor toward taste rather than toward a written rule, then drift back the same way.

Three smaller inconsistencies ride along. Formatting has three owners (biome at the root, a `prettier` script in the package, a `linper` alias that chains both), and the root `format:check` calls `biome format --check`, a flag Biome 2 removed, so the check dies with a config error instead of checking anything. Imports come in two dialects: 113 use the `@/` alias that `tsconfig.json` already defines, 250 lines in 114 files climb with `../`, and 150 specifiers across 67 folders name a folder whose `index.ts` re exports the symbol instead of naming the module. Helpers with one consumer sit in `src/common/helpers` (`getKeyRecommendations`, `getKeyProductsByCategory`), which makes the shared folder look bigger than it is.

The consequence of not deciding: the next feature adds another 400 line component, another `../` import and another `console` call, and the refactor rows return those files to the same shape within a month.

## Options considered

### Option 1: Write the standard, enforce the machine checkable part at error with a frozen baseline (chosen)

Five rules in `apps/customer/AGENTS.md`, their review form in `apps/customer/CODE_REVIEW.md`, three of them as ESLint errors, the noise that exists today captured in one `eslint-suppressions.json` that only shrinks, one named config exception for the file already scheduled for decomposition, and one codemod pass that makes the import rule true before it turns on.

**Pros**:
- The gate stops the three shapes that can be checked, and the baseline means the rules turn on today instead of after fifteen hours of refactoring.
- A reviewer cites a rule id instead of arguing taste, which is what the scope row asks for.
- The codemod removes every import and barrel entry the baseline would otherwise carry, so the file that survives holds four real entries.
- `linterOptions.noInlineConfig` makes the ban on inline disables a property of the config instead of a grep someone can forget to run.
- No waiver mechanism, so a rule that hurts is a discussion about the rule, not a comment nobody reads.

**Cons**:
- A new tracked artifact to maintain, and its counts are per file, so a fixed site and a new site in the same file cancel out.
- Most of the standard (where a helper lives, side effects, money, dates, barrels) is not machine checked.
- The codemod produces a 114 file diff with a recursive barrel resolution, so it must be trusted through the type gate and tests.

### Option 2: Write the standard, enforce nothing automatically

Document S1 to S5 and let review carry every rule.

**Pros**:
- No config change, no baseline, no codemod, no risk to a green gate.
- The standard can be argued in a review instead of fought with a tool.

**Cons**:
- The existing lint already shows what a rule nobody enforces is worth: 8 warnings that nobody fixed, and `react-hooks/set-state-in-effect` downgraded to warn instead of resolved.
- Nothing stops the next 400 line file, which is precisely the drift the review measured.
- A review comment still cites nothing that the repository can check.

### Option 3: Refactor first, then write the standard and switch the rules on

Close the ten files and the import sweep before any rule exists, then turn the rules on with no baseline at all.

**Pros**:
- The cleanest end state: no suppressions file at all, and the rules never have to be explained away.

**Cons**:
- About fifteen hours of refactoring across the Slice 2 rows before any rule can help, so the drift continues during the work.
- The refactor would still have no written rule to follow, which is the ordering problem this decision exists to fix.
- A rule invented after the refactor is validated by nothing: the first file written after it is the real test.

## Rationale

The review's root cause is P1-6: the lint gate has no structural rule, so the state it measured can be green. A standard that is only prose repeats that failure at larger scale, which rules out Option 2. Option 3 has the better end state but inverts the order: the refactor rows are the drain, and they need the rule now, not after they finish.

That leaves Option 1, and the measured facts of this repository shape its details.

**No 200 line target.** The owner's reading was that a number invites both fragmentation and gaming, and the repository agrees: the file the review calls the reference shape, `SellerOrders/index.tsx`, is 191 lines, so a 200 line ceiling would not have flagged anything the reference already does. A safety net at 400 code lines catches the runaway case and nothing else, and S1 carries the extraction principle at the function level too, so the "file and function size" in the scope row is answered without a number. The trade is stated in Consequences: a 380 line component passes the gate, so extraction still depends on review.

**A baseline for noise, a config exception for the one big file.** The owner first chose a suppressions baseline and then said no exceptions at all. Both cannot hold, so they were reconciled into one rule: no inline `eslint-disable` anywhere, and a single frozen file that only shrinks. The cross check then found that ESLint counts suppressions rather than matching them: `suppressions-service.js` suppresses while `violationsCount <= suppressionsCount`, and `max-lines` reports exactly once per file, so a baseline entry would have exempted `OrderPage` however large it grew, and the "only shrinks" check would never fire. The fix is a config override for that one file, written into Exceptions with row 3 as its owner. What remains in the baseline is four `console` files, where a count is an acceptable stand in for a fingerprint until each file is touched.

**`noInlineConfig`, not a grep.** The first draft enforced the no waiver rule with `grep -rn "eslint-disable" apps/customer/src`, which has no home (the lint script runs from the package directory, where that path does not resolve) and exits 1 on no match, so a naive chain is always red. ESLint 10 supports `linterOptions: { noInlineConfig: true }`, which makes an inline comment inert and lets the violation surface at its own line. The one comment that exists, `hooks/useFetcher.ts:82` on the deliberate full reload that ends a session, is deleted; its reason stays in the comment above, and the rule it silenced surfaces as a warning the gate tolerates.

**A codemod that resolves, not one that repoints.** The import rule is the place where the baseline would have been the wrong tool: `no-restricted-imports` with the group `../**` flags 250 lines in 114 files, and 114 entries would have hidden the four real ones. The cross check also showed that a codemod writing `@/common` and `@/hooks/...` would mass produce exactly the barrel imports S9 forbids, and that `apps/customer/AGENTS.md` already asks for hooks to be exported through `index.ts`. So the codemod resolves every specifier to the module that exports the symbol, follows re exports recursively, and stops with a list when a symbol is ambiguous. It covers `from` clauses, `vi.mock`, `vi.importActual` and dynamic `import()`: 23 `vi.mock` paths and 150 barrel specifiers were invisible to the first draft. The `../**` pattern was verified against the real tree: it flags `../../../common` and `../../../hooks/product/useCart` in `Cart/index.tsx` and leaves `./components` in `Home/index.tsx` alone, which is why S7 permits `./` and bans `../` only.

**`console.error` stays.** A full `no-console` ban leaves server code with no logging path at all, because no logger is installed: 15 of the 19 calls are `console.error`, including two in `src/common/helpers/session.ts`, which runs on the server. Allowing `error` keeps that path, bans the noise (4 sites in 4 files remain), and keeps the rule enforceable instead of pushing the next server helper into an exception.

**Three rules, not nine.** Only three rules are machine checkable with what is installed: `max-lines`, `no-console`, `no-restricted-imports`. A rule for `toFixed`, a currency literal or `getCurrencyEmoji` would need a custom plugin, and the config is deliberately written with core rules only (no `eslint-plugin-import`, no boundaries plugin), so those stay in the checklist. The same holds for side effects in a render body: `react-hooks` does not catch a `showToast` call in a component body, which is why S5 exists as a review item with its six sites named.

**`lib/` inside a feature.** The review proposed `model/`; the owner chose `lib/`. The cost is that `src/lib/utils.ts` (where shadcn expects `cn`) and a feature `lib/` share a name at two levels. Moving `cn` would break every vendored primitive, so the standard keeps `cn` where it is and says so, which is cheaper than either rename. S2 and S3 name `lib/styles.ts` for class constants, because the first draft forbade a class constant inside a component and gave it nowhere to go.

**One formatter, biome, for the root and the storefront.** Biome already runs in the root scripts, so the cheaper direction is to finish the job rather than to adopt prettier everywhere. Two details were verified rather than assumed: `biome format --check` is invalid in 2.6.4 while plain `biome format` exits 1 on a file it would rewrite, so `format:check` becomes the flagless form; and `biome check --write --only=organizeImports` parses while `--only=formatter`, `--only=format`, `--only=lint` and `--only=assist` do not, so import sorting needs that exact flag. The cross check added two corrections: the pre-commit hook is `exit 0` on purpose, so nothing runs `lint-staged` and this spec must not claim it does, and `apps/auth-astrum` formats with prettier, so the claim is scoped to the root and the storefront with auth recorded as a follow-up.

**The react-hooks exception, corrected.** The owner approved keeping `set-state-in-effect` at `warn` "for vendored `components/ui`". The warning list says otherwise: one of the eight sites is the vendored carousel, five are our own components and two are `incompatible-library` on React Hook Form, which no refactor can satisfy while that library is in use. The decision (keep warn, record it) stands; its scope was corrected to the whole package with the sites named.

## Cross check

The owner asked for a pass on another model. No `delegation` block exists in `config.yaml`, so `delegate_task` inherited the session model: this was a fresh read on deepseek-flash, not an independent model. Setting `delegation.provider` and `delegation.model` is what would make the next pass independent. The pass was read only, ran 40 tool calls against the tree and returned 19 findings, each one verified with a command. None was rejected.

Three changed a decision:

1. The `max-lines` baseline entry would have exempted the only over 400 line file forever (`violationsCount <= suppressionsCount`, one message per file). Replaced by a config override named in Exceptions.
2. A codemod writing `@/common` and `@/hooks/...` would have produced the barrel imports S9 bans, while `AGENTS.md` already asks for hooks to be exported through `index.ts`. The codemod now resolves to the module and that `AGENTS.md` line changes with it.
3. A full `no-console` ban had no logging path for server code. `console.error` is allowed and the remaining sites are four, not nineteen.

The rest were applied as written: the no waiver rule became `noInlineConfig` instead of a grep, the existing `eslint-disable` at `useFetcher.ts:82` is deleted, S8 stops claiming `lint-staged` runs and is scoped away from auth, S7 permits `./` and bans `../` only, S6 distinguishes a date shown from a date typed and lists the four `getCurrencyEmoji` amounts, S1 gains the function boundary, S2 and S3 gain `lib/styles.ts` and a test threshold, S3 lets a feature entry call its own hooks, S5 covers DOM writes in handlers, the codemod covers `vi.mock`, and row 3's `model/` becomes `lib/`.

## Evidence

Measured on `dev` at `f0b0ddd` (2026-11-11) unless noted, with the commands in the table.

| Probe                                 | Command                                                                                       | Result                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Source size                           | `find src -name '*.ts*' \| xargs wc -l`                                                       | 215 files, 15,287 lines                                                                                     |
| Lint                                  | `pnpm --filter @astrum/customer lint`                                                         | 0 errors, 8 warnings                                                                                        |
| Files above 200 raw lines             | `wc -l` over `src`, excluding `components/ui`                                                 | 10                                                                                                          |
| Code lines per file                   | `eslint --rule '{"max-lines":["error",{"max":1,"skipBlankLines":true,"skipComments":true}]}'` | `OrderPage` 491, `CheckoutForm` 374, `SellerOrders/index.test.tsx` 389, `Reviews` 366, `OptimizedImage` 333 |
| `console` by method                   | `grep -rho 'console\.[a-z]*' src \| sort \| uniq -c`                                          | 15 `error`, 3 `warn`, 1 `log`                                                                               |
| `console` sites left by the rule      | `grep -rn 'console\.\(warn\|log\)' src`                                                       | 4 in 4 files: `session.ts`, `OptimizedImage.tsx`, both `AddToCartWithQuantity` copies                       |
| `getCurrencyEmoji` as an amount       | `grep -rn getCurrencyEmoji src` minus `common/helpers`                                        | `ProductCard:40`, `ProductOverview:54`, `SellerOrderLine:76` and `:86`                                      |
| Relative imports                      | `grep -rn 'from "\.\./' src`                                                                  | 250 lines in 114 files (the review counted 393 occurrences of `../`, which counts each path segment)        |
| `vi.mock` with `../`                  | `grep -rn 'vi\.mock("\.\./' src`                                                              | 23                                                                                                          |
| Barrel specifiers                     | a resolution script over every `from`, `import` and `vi.mock` specifier                       | 150 in 67 folders, `src/common` 34                                                                          |
| Alias imports                         | `grep -rn 'from "@/' src`                                                                     | 113                                                                                                         |
| Existing inline disable               | `grep -rn eslint-disable src`                                                                 | `hooks/useFetcher.ts:82`                                                                                    |
| Suppression semantics                 | `eslint/lib/services/suppressions-service.js`                                                 | `if (violationsCount <= suppressionsCount)` suppresses, so a count is not a fingerprint                     |
| Stale suppression                     | `eslint <file> --suppressions-location <file with one unmatched entry>`                       | exits 2, `There are suppressions left that do not occur anymore`                                            |
| `no-console` with an empty allow list | `eslint --rule '{"no-console":["error",{"allow":[]}]}'`                                       | rejected: `Value [] should NOT have fewer than 1 items`                                                     |
| `../**` pattern                       | `eslint --rule '{"no-restricted-imports":["error",{"patterns":[{"group":["../**"]}]}]}'`      | flags `../../../common`, leaves `./components` clean                                                        |
| Biome check flag                      | `npx biome format --check <file>`                                                             | `Error: '--check' is not expected in this context`                                                          |
| Biome flagless check                  | `npx biome format <file>` on a misformatted file, then `--write`, then again                  | exit 1, then 0, then 0                                                                                      |
| Biome assist group                    | `npx biome check --only=<group> <file>`                                                       | `organizeImports` parses; `formatter`, `format`, `lint`, `assist` do not                                    |
| Import order drift                    | `npx biome check --only=organizeImports apps/customer/src`                                    | 10 files would reorder                                                                                      |
| Pre-commit hook                       | `cat .husky/pre-commit`                                                                       | `exit 0`, so nothing runs `lint-staged`                                                                     |
| Auth formatter                        | `grep '"format"\|prettier' apps/auth-astrum/package.json`                                     | `prettier --write`, with `eslint-plugin-prettier` installed                                                 |
| Error boundary                        | `grep -rln 'ErrorBoundary\|componentDidCatch' src`                                            | no match, so the "console except ErrorBoundary" exception had no file to apply to                           |
| `cn` home                             | `grep -rn 'export .*cn' src`                                                                  | `src/lib/utils.ts`, imported by every vendored primitive                                                    |

The review that started this work, with its findings and ranked backlog, is `docs/reviews/2026-11-11-customer-code-quality.md`. It is read only and unchanged by this run.
