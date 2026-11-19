# 0029. Enum labels follow the chosen language — rationale

## Context

The storefront is bilingual since spec 0006, and the mechanism is settled: next-intl without i18n routing, two message files under `apps/customer/messages/`, the language in the `NEXT_LOCALE` cookie, a server action writing it and `router.refresh()` repainting the screen. Everything a developer types reaches a screen in the chosen language.

Two sets of words escape that mechanism, because they arrive from data rather than from code. The product category is a database enum of ten values (`packages/Astrum-db/prisma/schema.prisma:306`) and the property label is an enum of 27 (`:276`), and both are printed as their own member name. The category strip is worse than that: it is a hand written array of nine English names in `src/common/constants/category.list.ts`, one entry short of the enum, missing `Office`, which holds 245 published products today.

A reader in Russian therefore sees Russian navigation, Russian buttons, English category names, and English property labels on every product screen. The words are short enough that a developer reads past them for months, and the only reason they surfaced is that the catalogue and the order screens share a language switch a reader actually uses.

The consequence of not deciding this is a permanent small lie in the interface: the shop says it speaks Russian and then hands over an English catalogue. It also leaves a real defect undeclared: the hand written strip can drift from the enum in either direction, and it already has.

## Options considered

### Option 1: a catalog section with typed key helpers and a coverage test

Both enums get one section in the message catalogs (`enums.category`, `enums.property`), one key per member. A new module `src/common/helpers/localizeHelper.ts` maps a member to its key with a typed return union, following the shape `staffRoles.ts` and `roleBadge.ts` already use. The strip derives from the enum. A suite reads both catalogs and both enums and fails on any of the four mismatch directions.

**Pros**:
- One mechanism for both sets, so the codebase keeps one way to name an enum, the way it already names staff roles and gender.
- The typed key union catches a rename at compile time, and the coverage test catches a missing key before a screen prints English.
- The strip derives from the enum, so `Office` appears and nothing can go missing again.

**Cons**:
- Two more catalog groups, 37 keys per language, and a new member costs three edits before the suite is green.
- A test that fails a build on a legitimate schema addition reads as friction the first time the team meets it.

### Option 2: one generic helper with a dictionary argument

A single `localizeEnum(table, value)` takes the mapping table at each call site, so the tables live near their enums and the helper carries no knowledge of any type.

**Pros**:
- One function instead of one function per enum; a new enum needs no change to the helper.
- The mapping table stays next to whoever owns the enum.

**Cons**:
- The key loses its type, since the argument arrives as a table value, so a rename is caught by tests only.
- Every call site carries a table, which the placement rule of spec 0010 pushes into `src/common/` anyway, so the indirection buys nothing.

### Option 3: a label table in the database

A `Label` table holding enum name, member, language and text, read through the api and rendered from the payload.

**Pros**:
- Copy lives with data, so a marketing change needs no deploy.
- One place for any future translated dictionary, property values included.

**Cons**:
- A read on every catalogue request, a migration, a seeding job and a cache to keep honest, for 37 words that change about once a year.
- Moves translation from the mechanism the project already runs into a second one, so a reader would meet two translation systems in one screen.

### Option 4: translate property values as well

Treat `ProductProperty.value` as translatable, either through catalog keys per known value or through a value dictionary.

**Pros**:
- Closes the last English and Russian mismatch on the product screen.
- A reader in the other language sees a fully translated specification list.

**Cons**:
- The database holds 6617 distinct values across 27721 rows, 6159 of them appearing fewer than ten times, so no dictionary can cover them and no test can hold them.
- The values are free text written by sellers and by the Excel seed, so a translation would either freeze the vocabulary or keep drifting with every import.

## Rationale

Option 1 wins on three forces. The project already answers this exact question twice, as a typed key helper in `staffRoles.ts` for the two staff roles and as an inline ternary with a raw fallback for `gender` in the profile form, so the build reads as a continuation rather than a new pattern. The catalog is already the single source of user facing words, with an existing suite in `src/i18n/__tests__/config.test.ts:33` that holds the two languages to the same key tree, which means the enforcement this feature needs is one more assertion in a place the team already trusts. And the strip's real defect is not translation but drift: nine hand written names against ten enum members, so deriving the list fixes the label and the missing category in one edit.

Option 4 was dropped on measurement, not on taste. A dictionary of 6617 entries is not a dictionary a person maintains, and the values arrive from an Excel seed in Russian, so the honest line is the one the scope already drew: labels are interface, values are data. The mismatch that remains is recorded in `## Follow-up` of the spec rather than left unsaid.

The narrower calls inside the decision follow the same instinct. The case is lower rather than a second table, because the gateway already parses a lower case slug and the storefront's addresses must not change with the language. The strip keeps the schema order rather than an alphabetic or popularity order, because a category list that jumps around when products land is noise on a page a reader scans by position. An unknown value prints as it arrived, matching the profile form's gender fallback, because a raw word beats a blank cell or a key path.

References: none. The stack is settled and the sources that shaped this decision are the code and the specs it continues: spec 0006 for the bilingual mechanism, spec 0010 for the placement and file rules this module obeys, spec 0017 for the `staffRoleLabelKey` precedent, spec 0023 for the profile form whose `gender` fallback this screen copies, and `apps/customer/AGENTS.md` for S1 to S5. The reasoning stays here rather than in a citation list, following the shape specs 0011, 0020, 0024, 0025, 0026 and 0027 already use for the same call.

## Evidence

Measured on 2026-11-19 against the working tree and the running development database (`docker exec astrum-db psql -U greedyghoster -d astrum-db`).

**Catalog strip and enums**:

| Measurement | Command | Result |
|---|---|---|
| hand written strip entries | `category.list.ts` | 9 names, `Office` absent |
| schema category members | `schema.prisma:306` | 10 |
| client `ProductCategory` members | `product.types.ts:61` | 9 |
| schema property labels | `schema.prisma:276` | 27 |
| client `PropertyLabel` members | `product.types.ts:44` | 14 |
| strip consumers | `grep -rn categoryList apps/customer/src` | 3 files, 5 call sites |
| message key tree parity already tested | `src/i18n/__tests__/config.test.ts:33` | equal trees and placeholders asserted |

**Product and property data**:

| Measurement | Command | Result |
|---|---|---|
| property rows | `SELECT count(*) FROM "ProductProperty"` | 27721 |
| distinct labels | `count(DISTINCT label)` | 26 in use of 27 members |
| distinct values | `count(DISTINCT value)` | 6617 |
| values appearing 100 times or more | grouped count | 26 |
| values appearing fewer than 10 times | grouped count | 6159 |
| published products per category | `SELECT category, status, count(*) FROM "Product" GROUP BY 1,2` | Electronics 1503, Home 2002, Toys 500, Automotive 500, Office 245; Fashion, Food, Beauty, Books, Sports none |

**Empty category copy today**: `CategoryPage/index.tsx` prints `t("end")` in the empty branch, which reads `No more results` (`ru`: `Больше товаров нет`), the same string the infinite scroll ends on.

**Test suite today**: 87 suite files and 443 cases under `apps/customer/src`, so the coverage suite of AC-10 joins a suite that already exists rather than starting one.
