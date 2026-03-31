# skills-tui Design Spec

> TUI for managing global agent skills - dashboard, marketplace browser, multi-agent orchestration.

## Overview

A terminal UI built with TypeScript + ink, compiled to a single binary via bun, distributed through Homebrew. Provides a three-column Miller Columns interface for managing AI agent skills across repos, skills, and agents.

## Core Entities

Three dimensions drive the data model:

- **Repo** — a GitHub repository containing one or more skills (e.g., `vercel-labs/agent-skills`)
- **Skill** — an individual skill within a repo, defined by a `SKILL.md` file with frontmatter
- **Agent** — a target AI coding agent (e.g., `claude-code`, `codex`, `cursor`)

## Data Model

```typescript
interface Repo {
  source: string;          // "vercel-labs/agent-skills"
  url: string;             // "https://github.com/vercel-labs/agent-skills"
  skills: LocalSkill[];    // installed skills from this repo
  skillCount: number;      // total skill count (including uninstalled)
  lastSynced?: Date;       // last update timestamp
}

interface LocalSkill {
  name: string;            // "frontend-design"
  description: string;     // from SKILL.md frontmatter
  repo: string;            // owning repo source
  canonicalPath: string;   // ~/.agents/skills/frontend-design/
  agents: AgentBinding[];  // agent bindings
  managed: boolean;        // true if canonicalPath resolves inside CANONICAL_ROOT
  get enabled(): boolean;  // computed: any AgentBinding.linked === true
}

// Skill identity: (repo, name) pair. Two repos may ship a skill with the
// same `name`; the skills package resolves this by storing one copy per name
// in ~/.agents/skills/. If a conflict is detected at install time (different
// repo already owns that name), skills-tui refuses the install and surfaces
// the conflict to the user rather than silently overwriting.

interface AgentBinding {
  agent: AgentType;        // "claude-code" | "codex" | ...
  linked: boolean;         // symlink exists in agent's skills dir
  linkPath: string;        // e.g., ~/.claude/skills/frontend-design
}

// Supported agents and their skill directories
// Full list imported from vercel-labs/skills `agents` config at runtime.
// Key agents:
//   claude-code → ~/.claude/skills/
//   codex       → ~/.openai-codex/skills/
//   cursor      → ~/.cursor/skills/
//   gemini-cli  → ~/.gemini/skills/
type AgentType = "claude-code" | "codex" | "cursor" | /* ... 40+ from skills package */;
```

## Architecture

```
skills-tui (single binary)
├── UI layer: ink (React for CLI)
│   └── Three-column Miller Columns
├── State layer: zustand
├── Data layer:
│   ├── Local: scan ~/.agents/skills/ + agent skill dirs
│   ├── Remote: skills.sh/api/search
│   └── Config: ~/.config/skills-tui/config.json
└── Operations: reuse vercel-labs/skills modules where possible
```

### Integration with vercel-labs/skills

**ADR: The `skills` npm package is a pure CLI (`"bin": {"skills": ...}`) with no library exports.** Functions like `searchSkillsAPI()`, `runAdd()`, `getAllLockedSkills()` are internal and cannot be imported.

**Strategy adopted:**
- **Lightweight ops** (scan, symlink, lock file parse, SKILL.md parse, API search) — self-implemented; the logic is straightforward filesystem + HTTP
- **Heavy ops** (add repo, sync/update, remove) — subprocess call to `npx skills add/sync/remove`
- **Agent config** — hardcoded registry of known agents with their skill directory paths, derived from the skills package source

**Self-implemented:**
- Lock file reader (`~/.agents/.skill-lock.json`) for repo grouping
- SKILL.md frontmatter parsing via `gray-matter`
- `skills.sh/api/search` HTTP client
- Symlink scanning/creation/deletion with ownership verification
- Three-column UI — entirely custom
- Config file management

**Via subprocess (`npx skills`):**
- `npx skills add <source> -g -a <agent> -y` — install skills from repo
- `npx skills update` — sync installed skills to latest
- `npx skills remove <skill> -g -a <agent> -y` — remove skills

### Repo Grouping via Lock File

The `skills` package maintains a lock file (`~/.agents/.skill-lock.json`) that records which plugin/repo each skill belongs to. On startup, `skills-tui` reads it via `getAllLockedSkills()` to group skills under their source repos. Since the `skills` package has no library exports, `skills-tui` reads the lock file directly at its known path (`~/.agents/.skill-lock.json`, or `$XDG_STATE_HOME/skills/.skill-lock.json` if set). This is the **only** use of the lock file — all enable/disable state comes from symlink presence.

## Enable/Disable Mechanism

Uses symlink presence as the single source of truth:

```
Enabled:  ~/.claude/skills/frontend-design → ~/.agents/skills/frontend-design
Disabled: symlink removed, source file at ~/.agents/skills/frontend-design preserved

Operations:
  disable → delete symlink in target agent dir
  enable  → recreate symlink
  remove  → delete source file + all symlinks (with confirmation)
```

### Ownership Verification

Before any symlink operation (disable/enable/remove), `skills-tui` validates:

1. **Managed check**: `realpath(symlink)` must resolve to a path inside `~/.agents/skills/` (the canonical root). Symlinks pointing elsewhere are marked `managed: false` and excluded from bulk operations.
2. **Lock file check**: the skill must have an entry in `getAllLockedSkills()`. Orphaned skills (present on disk but absent from lock file) are shown with a warning indicator but not auto-operated.

Non-managed entries are displayed in the UI (dimmed, with a "manual" badge) but `d`/`e`/`x` operations are blocked on them. The user can still inspect their details.

## UI Design

### Three-Column Miller Columns Layout

```
┌─ Repos ─────────┬─ Skills ──────────┬─ Detail ──────────────┐
│ ▶ vercel-labs/.. │ ▶ frontend-design │ frontend-design       │
│   baoyu/skills   │   skill-creator   │                       │
│   ljg/skills     │   animate         │ Source: vercel-labs/.. │
│   superpowers/.. │   audit           │ Path: ~/.agents/sk..  │
│                  │   web-access      │ Enabled: ✔            │
│                  │   ...             │                       │
│                  │                   │ Agents:               │
│                  │                   │  ✔ claude-code        │
│                  │                   │  ☐ codex              │
│──────────────────│                   │                       │
│ ▷ Market         │                   │ ── SKILL.md ────────  │
│   [search skills]│                   │ (frontmatter preview) │
├──────────────────┴───────────────────┴───────────────────────┤
│ Tab:switch  /search  a:add  d:disable  e:enable  x:delete   │
└──────────────────────────────────────────────────────────────┘
```

### Component Tree

```
<App>
  <Header />                     // title + version
  <MillerColumns>
    <RepoList />                 // left: installed repos + Market entry
    <SkillList />                // center: skills of selected repo
    <DetailPanel />              // right: skill detail + agent bindings
  </MillerColumns>
  <StatusBar />                  // bottom: shortcuts + operation feedback
  <SearchOverlay />              // / triggered, modal search
  <ConfirmDialog />              // destructive action confirmation
</App>
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Switch focus column |
| `Up` / `Down` / `j` / `k` | List navigation |
| `Enter` | Expand / enter |
| `/` | Search (local filter + market search) |
| `a` | Add repo source |
| `d` | Disable skill for **current highlighted agent** in Detail panel |
| `e` | Enable skill for **current highlighted agent** in Detail panel |
| `D` | Disable skill for **all** agents (with confirmation) |
| `E` | Enable skill for **all** `defaultAgents` |
| `x` | Delete skill/repo (with confirmation) |
| `Space` | Toggle agent binding (same as `d`/`e` for highlighted agent) |
| `u` | Update selected repo's skills |
| `q` / `Ctrl+C` | Quit |

### Market Mode

When "Market" is selected in the left column, the center column switches to skills.sh search results, and the right column shows remote skill detail with install action. Search calls `skills.sh/api/search` with 150ms debounce.

**Market install flow:**
1. User selects a skill from search results, presses `Enter`
2. Confirm dialog shows skill name + source repo
3. On confirm, calls `runAdd(source, { skill: [name], global: true, agent: defaultAgents })`
4. Skill is cloned to `~/.agents/skills/<name>/`, symlinks created for `defaultAgents`
5. Config's `repos` list updated if this is a new repo source
6. UI refreshes, new skill appears in Repos view

### Search Behavior

`<SearchOverlay />` is a single component with context-aware behavior:
- **In Repos/Skills columns**: local fuzzy filter over current list, results inline. Esc restores unfiltered view, focus stays on current column.
- **In Market column**: calls `skills.sh/api/search`, results replace the skill list. Esc clears search, focus stays on Market.

## Feature Matrix

| Feature | Trigger | Implementation |
|---------|---------|----------------|
| List installed skills | Startup | Scan agent dir symlinks + `getAllLockedSkills()` for repo grouping |
| Enable/disable skill | `e`/`d` (single agent), `E`/`D` (all agents) | Create/delete symlinks; single-agent ops need Detail panel focus with agent highlighted |
| Toggle agent binding | `Space` | Check/uncheck agent in Detail panel, operate symlinks |
| Add repo | `a` (RepoList focused) | Input `owner/repo`, call `runAdd()` with `defaultAgents` |
| Delete skill/repo | `x` | Remove source + all symlinks, with confirm dialog |
| Update repo | `u` | Call `runSync()` to pull latest, update `repo.lastSynced` |
| Market search | `/` in Market | Call `skills.sh/api/search`, select to install |
| Local filter | `/` in Repos/Skills | Frontend fuzzy match, realtime filter |

## Error Handling

- **Dangling symlink** (source deleted) — mark as `broken`, red indicator in Detail
- **skills.sh unreachable** — Market shows offline status, local features unaffected
- **Terminal too narrow** — below 100 cols: hide Detail panel (two columns). Below 50 cols: show only the focused column

## Configuration

`~/.config/skills-tui/config.json`:

```json
{
  "defaultAgents": ["claude-code"],
  "repos": [
    { "source": "vercel-labs/agent-skills", "addedAt": "2026-03-31" }
  ]
}
```

Config stores only TUI-specific state. Skill installation state is derived entirely from filesystem symlinks.

### Canonical Directory

`~/.agents/skills/` is the canonical source directory, created and managed by the `skills` package. Each agent's skill dir (e.g., `~/.claude/skills/`) contains symlinks pointing into this canonical dir. `skills-tui` reads from it but does not own its creation — the `skills` package handles that via `runAdd()`.

## Tech Stack

- **Runtime**: Bun
- **UI**: ink (React for CLI)
- **State**: zustand
- **Linting**: Biome
- **Testing**: vitest + ink-testing-library
- **Build**: `bun build --compile` → single binary
- **Distribution**: Homebrew via kassol/homebrew-tap

## Project Structure

```
skills-tui/
├── src/
│   ├── app.tsx
│   ├── components/
│   │   ├── MillerColumns.tsx
│   │   ├── RepoList.tsx
│   │   ├── SkillList.tsx
│   │   ├── DetailPanel.tsx
│   │   ├── StatusBar.tsx
│   │   ├── SearchOverlay.tsx
│   │   └── ConfirmDialog.tsx
│   ├── hooks/
│   │   ├── useSkills.ts
│   │   ├── useFocus.ts
│   │   └── useSearch.ts
│   ├── services/
│   │   ├── scanner.ts
│   │   ├── linker.ts
│   │   ├── repo.ts
│   │   ├── market.ts
│   │   └── config.ts
│   └── types.ts
├── tests/
│   ├── scanner.test.ts
│   ├── linker.test.ts
│   └── components/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── homebrew.yml
├── package.json
├── tsconfig.json
├── biome.json
├── README.md
├── CONTRIBUTING.md
├── LICENSE (MIT)
└── AGENTS.md
```

## CI/CD

**ci.yml** (PR / push):
```
biome check → tsc --noEmit → vitest
```

**release.yml** (tag `v*`):
```
bun compile → produce binaries:
  - skills-tui-darwin-arm64
  - skills-tui-darwin-x64
  - skills-tui-linux-x64
→ GitHub Release + upload artifacts + SHA256
```

**homebrew.yml** (post-release):
```
→ Update kassol/homebrew-tap/Formula/skills-tui.rb
  - Update url + sha256
  - Auto-commit PR to homebrew-tap
```

## Installation

```bash
# Homebrew (primary)
brew tap kassol/tap
brew install skills-tui

# Direct download
curl -fsSL https://github.com/kassol/skills-tui/releases/latest/download/skills-tui-darwin-arm64 -o skills-tui
chmod +x skills-tui

# From source
git clone https://github.com/kassol/skills-tui && cd skills-tui
bun install && bun run build
```
