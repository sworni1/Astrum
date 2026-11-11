# Storefront code review checklist

The review form of the coding standard in [AGENTS.md](AGENTS.md). Read the diff, then walk this list. Every item names the rule it enforces, so a comment points at a rule instead of an opinion.

## Shape of a file

- [ ] The file holds one component or one module, and a function that mixes two jobs is split at that boundary. (S1)
- [ ] Constants, lookup tables, label and variant maps, style class constants, pure functions, shared types and named child components each have their own file, not the component file. (S1)
- [ ] A feature folder keeps `index.tsx` as composition only, children in `components/`, constants and pure code in `lib/`, its own state in `hooks/`. (S2)

## Placement

- [ ] A constant, table or helper with one consumer sits in the feature's `lib/`; `src/common/` only holds what two or more features use. (S3)
- [ ] No import names a folder barrel, no new barrel is created, and imports outside the folder use `@/` with no `../` anywhere. (S3, S5)

## Behaviour

- [ ] No `showToast`, `router.push`, `document` access or DOM write runs in a render body or behind React; a failure surfaces from a handler or an effect plus a rendered state, never a silent `return null`. (S4)
- [ ] Every user facing amount goes through `formatMoney(amount, currency)`, with no `toFixed`, no currency symbol in JSX and no `getCurrencyEmoji` as an amount; dates print through `useFormatter`. (S4)

## Process

- [ ] No new `console` call except `console.error`, and no `eslint-disable` comment, because it is inert inside `src` and the violation surfaces at its own line. (Enforcement)
- [ ] A fixed violation prunes its `eslint-suppressions.json` entry in the same change (`npx eslint . --prune-suppressions`), because a stale entry fails the run. (Enforcement)
- [ ] The file layout comes from `pnpm format` (biome), and no package level prettier config is added. (S5)
