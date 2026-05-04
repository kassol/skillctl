# skillctl

`skillctl` is a repo/source/skill/provider control plane for **user-level global AI agent skills**. It complements, rather than replaces, `npx skills`.

```text
npx skills  -> install, update, remove, provider distribution
skillctl    -> repo views, local source lifecycle, diff, promote/adopt, provider sync checks
```

It only manages:

```text
~/.agents/skills
~/.agents/.skill-lock.json
~/.config/skillctl/config.json
```

Project/workspace skills remain managed directly through `npx skills`.

## Install

### Homebrew

```bash
brew tap kassol/tap
brew install skillctl
```

### Direct binary download

Download the latest release from <https://github.com/kassol/skillctl/releases> and place `skillctl` in your `$PATH`.

### From source

```bash
git clone https://github.com/kassol/skillctl
cd skillctl
bun install
bun run build
./skillctl --help
```

## Quick start

```bash
skillctl init

skillctl source add my-skills \
  --path ~/Workspace/my-skills \
  --install-ref kassol/my-skills \
  --remote git@github.com:kassol/my-skills.git \
  --agent '*'

skillctl repo list
skillctl source diff my-skills
skillctl skill status my-skills apimart-image
skillctl provider status --skill apimart-image
```

## Commands

### Config

```bash
skillctl config list
skillctl config get runtime.globalStore
skillctl config set runtime.npx "npx --yes skills"
skillctl config unset sources.my-skills.remote
skillctl config edit
```

Config is user-level only: `~/.config/skillctl/config.json`.

### Repo

`repo` is any `npx skills` installable ref, such as `owner/repo`, a Git URL, or a local path. Repos are not stored in config.

```bash
skillctl repo list
skillctl repo scan kassol/my-skills
skillctl repo diff kassol/my-skills
skillctl repo installed kassol/my-skills
skillctl repo install-new kassol/my-skills --dry-run
```

### Source

`source` is a configured local canonical repo that `skillctl` may write to.

```bash
skillctl source add my-skills --path ~/Workspace/my-skills --install-ref kassol/my-skills
skillctl source list
skillctl source scan my-skills
skillctl source status my-skills
skillctl source diff my-skills
skillctl source remove my-skills
```

### Skill lifecycle

`skill` commands only operate on skills inside a configured source.

```bash
skillctl skill status my-skills boyunji-writer
skillctl skill dev my-skills boyunji-writer
skillctl skill promote my-skills boyunji-writer
skillctl skill adopt my-skills new-skill --install
skillctl skill discard my-skills boyunji-writer
skillctl skill publish my-skills boyunji-writer --push
```

Write operations support `--dry-run` and `--yes` where confirmation is needed. `skillctl` never commits or pushes unless a command explicitly requests it (for example `skill publish --push`).

### Install layer

```bash
skillctl install list
skillctl install list --repo kassol/my-skills
skillctl install list --source my-skills
skillctl install diff my-skills
skillctl install sync-new my-skills
skillctl install sync-new my-skills --from remote
```

### Provider sync

Provider data is read from `npx skills ls -g --json` and known provider directories. Provider configuration is not persisted in `skillctl` config.

```bash
skillctl provider list
skillctl provider list --skill boyunji-writer
skillctl provider status
skillctl provider status --provider claude-code
skillctl provider status --source my-skills
skillctl provider diff --skill boyunji-writer
skillctl provider unlink --provider claude-code --skill boyunji-writer
skillctl provider resync --provider claude-code --skill boyunji-writer
```

`provider unlink` only removes the dedicated provider entry, such as `~/.claude/skills/<skill>`. It does not delete `~/.agents/skills/<skill>` or edit the lockfile. Native-global providers such as Pi read `~/.agents/skills` directly and cannot be unlinked per skill.

## Configuration shape

```json
{
  "version": 1,
  "runtime": {
    "globalStore": "~/.agents/skills",
    "lockFile": "~/.agents/.skill-lock.json",
    "npx": "npx --yes skills"
  },
  "sources": {
    "my-skills": {
      "path": "/Users/kassol/Workspace/my-skills",
      "remote": "git@github.com:kassol/my-skills.git",
      "installRef": "kassol/my-skills",
      "defaultAgents": ["*"],
      "publishBranch": "main",
      "fullDepth": false
    }
  }
}
```

## Development

```bash
bun install
bun run dev -- --help
bun run lint
bun run type-check
bun run test -- --run
bun run build
```

## Tech stack

- Runtime/build: Bun + TypeScript
- CLI: commander
- Config validation: zod
- File scanning: fast-glob + gray-matter
- Diffs: diff
- Output: picocolors
- Tests: vitest
- Lint/format: Biome

## License

MIT
