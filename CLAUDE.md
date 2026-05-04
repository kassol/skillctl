# skillctl

## Overview
`skillctl` is a Bun/TypeScript CLI for user-level global AI agent skills. It adds repo/source/skill/provider observability and lifecycle workflows on top of `npx skills`.

Scope is intentionally user-level only:
- `~/.agents/skills`
- `~/.agents/.skill-lock.json`
- `~/.config/skillctl/config.json`

Project/workspace skills stay under direct `npx skills` management.

## Tech Stack
- Runtime/build: Bun + TypeScript
- CLI framework: commander
- Config/schema: zod
- Skill scanning: fast-glob + gray-matter
- Diffs: diff
- Output: picocolors
- Tests: vitest
- Lint/format: Biome

## Common Commands
- `bun run dev -- --help` — run CLI from source
- `bun run lint` — Biome check
- `bun run type-check` — TypeScript check
- `bun run test -- --run` — vitest suite
- `bun run build` — compile `skillctl`

## Architecture Rules
- Keep `npx skills` as the installer and provider distribution source of truth.
- Do not write `~/.agents/.skill-lock.json` directly.
- Do not persist provider registry data in `skillctl` config.
- New write operations need `--dry-run`; destructive operations need confirmation or `--yes`.
- Normal lifecycle commands must not auto-commit or auto-push. `skill publish --push` is the explicit push path.
- Keep the project as a direct CLI. UI frameworks and interactive terminal interface code are out of scope.

## Directory Map
- `src/app.ts` — command tree and CLI entrypoint
- `src/types.ts` — shared domain types
- `src/services/config.ts` — user config schema and dotpath operations
- `src/services/diff.ts` — repo/source/install diff logic
- `src/services/npxSkills.ts` — adapter around `npx --yes skills`
- `src/services/providers.ts` — provider inventory/status/unlink helpers
- `src/services/refs.ts` — repo ref normalization and Git snapshot cache
- `src/services/scanner.ts` — SKILL.md scanning, lock parsing, hashing/diff/copy
- `docs/skillctl-architecture.md` — external architecture and release notes

## Release
Release tags trigger `.github/workflows/release.yml`, which builds macOS binaries, publishes a GitHub release, renders `skillctl.rb`, and updates `kassol/homebrew-tap`.
