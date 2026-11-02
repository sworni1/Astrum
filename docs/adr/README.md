# Architecture decision records

One file per decision that is expensive to reverse: `NNNN-kebab-title.md`.

## Index

| ADR                                           | Title                                                                          | Status   |
| --------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| [0001](./0001-monorepo-service-boundaries.md) | Monorepo with a gateway and a separate auth service                            | Accepted |
| [0002](./0002-toolchain-baseline.md)          | Toolchain baseline — TypeScript 7 with a TypeScript 6 API, NestJS 11, Prisma 7 | Accepted |

## When to write one

Write an ADR when the choice changes the shape of the system: a new service, a new data store, the auth model, the message flow between packages, a build or deploy strategy. Do not write one for a library that a single package uses.

## Status values

`Proposed` → `Accepted` → `Superseded by NNNN`. Only the author of the change moves the status.

Copy [TEMPLATE.md](./TEMPLATE.md) to start a new record.
