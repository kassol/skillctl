# Contributing to skillctl

## Prerequisites

- Bun >= 1.0
- Node.js/npm available for `npx skills` subprocess calls
- Git available for remote repo snapshots and source status checks

## Setup

```bash
git clone https://github.com/kassol/skillctl
cd skillctl
bun install
bun run dev -- --help
```

## Development

- `bun run dev -- <args>` — run the CLI from source
- `bun run test -- --run` — run tests (vitest)
- `bun run lint` — check formatting and lint rules (Biome)
- `bun run lint:fix` — auto-fix formatting/imports
- `bun run type-check` — TypeScript type checking
- `bun run build` — compile the `skillctl` binary

## Safety expectations

- Keep `npx skills` as the installer/provider distribution source of truth.
- Keep config user-level only (`~/.config/skillctl/config.json`).
- Add `--dry-run` support to new write operations.
- Require confirmation or `--yes` for destructive operations.
- Do not auto-commit or auto-push from normal lifecycle commands.

## Pull Requests

- Write or update tests for new behavior.
- Run lint, type-check, tests, and build before submitting.
- Keep command output scriptable; add `--json` support for new read commands where practical.
- Keep commits focused and describe user-visible command changes.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
