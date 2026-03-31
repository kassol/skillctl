# skills-tui

## Overview
Terminal UI for managing global AI agent skills. Three-column Miller Columns layout with marketplace browsing.

## Tech Stack
- Runtime: Bun
- UI: ink (React for CLI)
- State: zustand
- Testing: vitest
- Linting: Biome
- Build: bun build --compile

## Directory Structure
- `src/` — source code
  - `components/` — ink React components (App, Header, StatusBar, RepoList, SkillList, DetailPanel, MillerColumns, SearchOverlay, ConfirmDialog)
  - `hooks/` — React hooks and zustand store (useSkills, useFocus, useSearch)
  - `services/` — business logic (scanner, linker, market, repo, config)
  - `types.ts` — shared type definitions
  - `agents.ts` — known agent registry
  - `app.tsx` — entry point
- `tests/` — vitest test files
- `.github/workflows/` — CI/CD pipelines

## Common Commands
- `bun run dev` — run in development
- `bun run test` — run tests
- `bun run lint` — check linting
- `bun run build` — compile to single binary

## Architecture
Services layer (scanner, linker, market, repo, config) handles all I/O. Zustand store manages UI state. Ink components render the TUI. Keyboard handler (useFocus) dispatches actions to services and updates store.
