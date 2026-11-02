# Documentation

Project documentation lives here and stays tracked in git.

## Layout

| Path             | Holds                                                                       |
| ---------------- | --------------------------------------------------------------------------- |
| `DEVELOPMENT.md` | Development guide: scripts, hooks, commit convention, environment, MVP gaps |
| `adr/`           | Architecture decision records, one file per irreversible decision           |
| `changelog/`     | Dated change entries, one file per working session                          |
| `specs/`         | Feature specs `NNNN-title.md`, created by /architect or /scope when needed  |
| `scope/`         | Living scope, created by /scope when needed                                 |

`specs/` and `scope/` appear the first time a spec or a scope is written; there is no empty placeholder folder for them.

## Conventions

- An ADR records a decision that is expensive to reverse. A spec records the contract of one feature. They link both ways.
- Every ADR and spec is written in English, so tooling and search stay reliable.
- Changelog entries follow Conventional Commits, use the date in the filename, and describe what changed for the reader, not the diff.

See [adr/README.md](./adr/README.md) for the decision log and [changelog/](./changelog/) for the history.
