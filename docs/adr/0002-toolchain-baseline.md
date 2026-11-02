# 0002: Toolchain baseline — TypeScript 7 with a TypeScript 6 API, NestJS 11, Prisma 7

- **Status**: Accepted
- **Date**: 2026-11-02
- **Deciders**: repo owner
- **Related**: `docs/changelog/2026-11-02-dependency-upgrade.md`

## Context

The whole monorepo was bumped to the newest published direct dependency. Three of those
"latest" targets cannot be used unconditionally, because they change the runtime or the
tool API in ways the codebase cannot absorb without a rewrite:

1. **TypeScript 7.0** is the native (Go) compiler. It ships the `tsc` binary but no
   programmatic compiler API until 7.1. `ts-jest` and `typescript-eslint` both import
   `typescript` and call the API, so both fail hard on TS 7: `typescript-eslint` refuses
   with "does not support TS 7.0", and `ts-jest` dies inside `transpile-module.js` because
   the module-level `typescript` import has no `ModuleKind`.
2. **NestJS 12** is published ESM-only (`"type": "module"` for `@nestjs/common`, `core`,
   `jwt`, `passport`, `swagger`, and `@nestjs/config` 12). `apps/auth-astrum` is CommonJS
   with `nest build` and `ts-jest`.
3. **Prisma** `latest` resolves to `8.0.0-rc.29`; the stable release sits on the `prev` tag
   at 7.10.1. The workspace also declared `catalog: prisma: latest`, which would have
   silently pulled the RC the first time a package used it.

## Options considered

1. **TypeScript**: keep TS 7 everywhere and replace the test transformer (`@swc/jest`) and the
   type-aware lint (`typescript-eslint` off) — loses type-aware lint rules and needs
   separate decorator-metadata config for Nest tests.
2. **TypeScript**: pin `typescript` back to 5.9 — loses the 2x type-check speedup and the
   owner asked for latest.
3. **TypeScript** (chosen): the official side-by-side layout — `typescript` aliased to
   `@typescript/typescript6` (re-exports the stable 6.0 API for tooling) plus
   `@typescript/native` aliased to `typescript@7` (provides the `tsc` binary).
4. **NestJS**: ESM rewrite of the auth service plus a new test runner — roughly a day of
   risk on DI, build and e2e wiring, for no functional gain.
5. **NestJS** (chosen): stay on the 11.2.8 line (CommonJS), which already contains the fix
   for the `@nestjs/core` injection advisory (`>=11.1.18`).
6. **Prisma** (chosen): pin 7.10.1, the newest stable, and replace the `latest` catalog
   entry with the concrete version so an RC can never be resolved implicitly.

## Decision

`typescript` resolves to `@typescript/typescript6` in every package and `@typescript/native`
resolves to `typescript@7`. `tsc` therefore runs TypeScript 7 while `types-jest`,
`typescript-eslint` and the editors keep the TypeScript 6 API. Any new tool that needs a
compiler API must consume `typescript`, never `@typescript/native`.

`@nestjs/*` stays on the 11.2.8 line with `@nestjs/config` 4.0.4 (the last CommonJS major).
Migrating `apps/auth-astrum` to NestJS 12 is a deliberate, separate task: it requires
`"type": "module"`, NodeNext resolution with explicit `.js` import extensions, and a test
runner that speaks ESM.

Prisma stays at 7.10.1 until 8.0.0 leaves the release-candidate stream.

## Consequences

- **Positive**: the repo runs the fastest available TypeScript (4.7 s → 2.1 s for the full
  type-check), keeps type-aware linting, keeps the existing jest suites untouched, and no
  dependency can silently land on a release candidate.
- **Negative**: two TypeScript packages in every `package.json` — a reader must know that
  `typescript` is not the compiler here. `tsc` and `tsc6` both exist on disk, so a stray
  `npx tsc6` would check with the older compiler.
- **Debt accepted**: the NestJS 12 / ESM migration is deferred; when it happens, the
  `typescript` alias must be revisited together with the test runner.
