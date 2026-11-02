# 2026-11-02 · Context files, git hooks and docs structure

## Added

- `AGENTS.md` at the repo root and one per workspace (`apps/customer`, `apps/api-astrum`, `apps/auth-astrum`, `packages/Astrum-db`), generated from a full repo scan.
- `CLAUDE.md` pointers next to every `AGENTS.md`, each one importing the sibling file.
- `.husky/commit-msg`, `.husky/pre-commit` and `.husky/pre-push`.
- Root `.prettierrc` and `prettier` in root dev dependencies, so `pnpm format` and lint-staged work under pnpm isolation.
- `docs/README.md`, `docs/adr/README.md`, `docs/adr/TEMPLATE.md` and `ADR-0001` on the monorepo boundaries.

## Changed

- Root `test` script now runs `turbo test`; the call to the missing `scripts/test-python.sh` and the `test:py` script are gone, since the repo has no Python package.
- Root `lint-staged` formats every staged file with prettier instead of calling ESLint from the root, where no ESLint install exists. ESLint still runs per package through `pnpm lint`, which is part of `quality-gate` on pre-push.
- `pnpm-workspace.yaml` `allowBuilds` now holds real `true` values instead of placeholder text, and the deprecated `pnpm.onlyBuiltDependencies` block left `package.json`.
- Removed the `mcp:check` script that pointed at a file which does not exist.
- `endOfLine: "auto"` in the root and in `apps/auth-astrum/.prettierrc`, so prettier stops rewriting CRLF files to LF and leaving phantom modified files under `core.autocrlf=true`.

## Verified

- `bash .husky/commit-msg` rejects a message without a type and accepts `feat(husky): ...`.
- `pnpm check-types`: 4 of 4 packages pass.
- `pnpm quality-gate`: 14 of 14 tasks pass, including 7 API tests and the ESLint run in customer and auth.
