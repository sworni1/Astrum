# Verify: storefront coding standard · spec 0010 · updated 2026-11-11

_Steps derived from the rules S1 to S5 and the scope row's done condition. `/check verify` runs these; `/test` locks the durable ones._

There are no acceptance criteria in this spec on purpose: a cross cutting standard records a decision, and its acceptance condition is the `Done when:` line of row 2 in `docs/scope/customer/scope.md`. Each step names the rule it proves.

Run commands from the repository root unless a step says otherwise. `CUSTOMER=apps/customer`.

## The resolved config carries the rules, and only where they belong

- [ ] `cd $CUSTOMER && npx eslint --print-config src/features/pages/Home/index.tsx` → `max-lines` with `max: 400`, `skipBlankLines: true`, `skipComments: true`; `no-console` with `allow: ["error"]`; `no-restricted-imports` with the group `../**`; `linterOptions.noInlineConfig: true` → S1, S7, Enforcement
- [ ] `npx eslint --print-config src/features/pages/Orders/OrderPage/index.tsx` (from `$CUSTOMER`) → `max-lines` reads the 400 line rule, with no per file exception → Exceptions
- [ ] `npx eslint --print-config src/features/pages/SellerOrders/index.test.tsx` (from `$CUSTOMER`) → `max-lines` reads `off`, the other two rules are present → Exceptions
- [ ] `npx eslint --print-config src/components/ui/button.tsx` (from `$CUSTOMER`) → none of the three rules appear → Exceptions

## The gate is green and the baseline holds only the noise

- [ ] `pnpm --filter @astrum/customer lint` → 0 errors, 8 warnings, and none of the three enforced rules among them → Exceptions
- [ ] `cat $CUSTOMER/eslint-suppressions.json` → `{}`, no entry: the two `console` sites the baseline held now log through `console.error`, and no `max-lines` or `react-hooks` key was ever recorded → Enforcement
- [ ] `git check-ignore $CUSTOMER/eslint-suppressions.json; echo $?` → `1`, so the file is committed → Enforcement
- [ ] Add one entry for a file that violates nothing, run `pnpm --filter @astrum/customer lint` → exit 2 with `There are suppressions left that do not occur anymore`; remove the entry → Enforcement
- [ ] Add one `console.warn` to any component, run `--suppress-rule no-console`, fix the call, run lint → it fails on the stale entry until `npx eslint . --prune-suppressions` runs in the same change → Enforcement

## Imports have one dialect and name a module

- [ ] `grep -rn 'from "\.\./' $CUSTOMER/src --include=*.ts --include=*.tsx | grep -v 'components/ui' | wc -l` → `0` → S7
- [ ] `grep -rn 'vi\.mock("\.\./' $CUSTOMER/src | wc -l` → `0` → S7
- [ ] Re-run the resolution probe over every `from`, `import` and `vi.mock` specifier → `0` specifiers resolve through an `index.ts` barrel. Before the codemod the same probe answers 150 across 67 folders → S9
- [ ] `pnpm --filter @astrum/customer check-types` → clean, which is the evidence that the codemod kept every resolution → S7
- [ ] `pnpm --filter @astrum/customer test` → same suite count as before the codemod, nothing skipped → S7

## No waivers

- [ ] `grep -rn "eslint-disable" $CUSTOMER/src` → no match → Enforcement
- [ ] Positive control: create `$CUSTOMER/src/console-probe.ts` holding `/* eslint-disable no-console */` and `console.log("x")`, run lint → the file still reports `no-console`, which proves the inline comment is inert; delete the probe → Enforcement

## One formatter

- [ ] `grep -n 'prettier\|linper\|trivago' $CUSTOMER/package.json` → no match → S8
- [ ] `grep -n '"prettier"' package.json` → no match, and `ls .prettierrc` → no such file → S8
- [ ] `grep -n '"format:check"' package.json` → `biome format` with no `--check` flag → S8
- [ ] `pnpm format:check` → exit 0 on the committed tree → S8
- [ ] `npx biome check --only=organizeImports $CUSTOMER/src` → no files to reorder. Before the format commit the same command names 10 files → S8
- [ ] `pnpm format` twice in a row → the second run reports no fixes → S8

## The documents exist and match the rules

- [ ] `grep -c '^### S[1-5]\.' $CUSTOMER/AGENTS.md` → `5`, inside a `## Coding standard` section → S1 to S5
- [ ] `grep -n 'CODE_REVIEW.md' $CUSTOMER/AGENTS.md` → one link, and `$CUSTOMER/CODE_REVIEW.md` exists → the checklist is reachable from the file a builder reads
- [ ] `grep -c '^- \[ \] ' $CUSTOMER/CODE_REVIEW.md` → at least ten items, each naming its rule id → a reviewer can point at one
- [ ] `grep -n 'exported through' $CUSTOMER/AGENTS.md` → no match, because the hooks line now names a module path → S9

## Manual

- [ ] Hand a reviewer a diff that adds a helper to `src/common/helpers` with one caller → the review cites S4 and asks for the helper in the feature's `lib/`. This is the only step that proves the standard is usable by a person, not just by a tool
- [ ] Hand a reviewer a diff that calls `showToast` in a component body → the review cites S5, which no lint rule covers
- [ ] Hand a reviewer a diff that prints `$${amount.toFixed(2)}` → the review cites S6
- [ ] Hand a reviewer a diff that puts a lookup table inside a component file → the review cites S2
- [ ] Read the `## Coding standard` section as someone who has not seen this spec → each rule names a place or a mechanism, and none needs the review file to make sense
