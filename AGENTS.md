# skillctl

## Overview
`skillctl` is a command-line control plane for user-level global AI agent skills. It complements `npx skills` by adding repo-level views, configured local source lifecycle management, install/runtime diffs, promote/adopt/discard flows, and provider sync checks.

It only manages:
- `~/.agents/skills`
- `~/.agents/.skill-lock.json`
- `~/.config/skillctl/config.json`

It does not manage project/workspace skills.

## Tech Stack
- Runtime/build: Bun + TypeScript
- CLI: commander
- Config validation: zod
- File scanning: fast-glob + gray-matter
- Diffs: diff
- Output: picocolors
- Testing: vitest
- Linting/formatting: Biome
- Build: `bun build --compile`

## Directory Structure
- `src/app.ts` — CLI entry point and command tree
- `src/types.ts` — shared domain types
- `src/services/` — business logic
  - `config.ts` — user-level config schema, read/write, dotpath get/set/unset
  - `diff.ts` — repo/source/install comparison logic
  - `git.ts` — source repo git status/push helpers
  - `npxSkills.ts` — adapter for `npx --yes skills`
  - `output.ts` — table/JSON/status output helpers
  - `paths.ts` — home/config/cache path helpers
  - `process.ts` — subprocess helpers
  - `prompt.ts` — confirmation prompts
  - `providers.ts` — provider inventory/status/unlink helpers
  - `refs.ts` — repo ref normalization and remote cache cloning
  - `scanner.ts` — SKILL.md scanning, lock parsing, dir hashing/diff/copy
- `tests/` — vitest coverage for services
- `.github/workflows/` — CI/release/Homebrew tap automation

## Common Commands
- `bun run dev -- --help` — run CLI in development
- `bun run test -- --run` — run tests
- `bun run lint` — check linting/formatting
- `bun run type-check` — TypeScript type checking
- `bun run build` — compile to single `skillctl` binary

## Architecture Rules
- Do not reintroduce Ink, React, Zustand, or TUI code.
- Use `npx skills` as the source of truth for install/update/provider distribution.
- Do not persist provider registry data in config; read it dynamically from `npx skills ls -g --json` and known provider dirs.
- All write/destructive operations should support `--dry-run`; destructive operations should support `--yes`.
- Never auto-commit. Only push when explicitly requested by a command such as `skill publish --push`.
