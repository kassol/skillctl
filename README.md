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

skillctl source add my-source \
  --path ~/Workspace/skills-source \
  --install-ref <owner>/<skills-repo> \
  --remote git@github.com:<owner>/<skills-repo>.git \
  --agent '*'

skillctl repo list
skillctl source diff my-source
skillctl skill status my-source example-skill
skillctl provider status --skill example-skill
```

## Agent companion skill

This repository also ships an agent-facing skill for safe, step-by-step `skillctl` operations.

Install it from this repository's GitHub slug:

```bash
npx --yes skills add kassol/skillctl -g --skill skillctl-manager --agent '*' -y
```

Use it when you want an agent to audit, clean, adopt, promote, discard, publish, or repair user-level global skills through `skillctl` and `npx skills` without hand-editing lockfiles.

## Commands

### Config

```bash
skillctl config list
skillctl config get runtime.globalStore
skillctl config set runtime.npx "npx --yes skills"
skillctl config unset sources.my-source.remote
skillctl config edit
```

Config is user-level only: `~/.config/skillctl/config.json`.

### Repo

`repo` is any `npx skills` installable ref, such as `owner/repo`, a Git URL, or a local path. Repos are not stored in config.

```bash
skillctl repo list
skillctl repo scan <owner>/<skills-repo>
skillctl repo diff <owner>/<skills-repo>
skillctl repo installed <owner>/<skills-repo>
skillctl repo install-new <owner>/<skills-repo> --dry-run
```

### Source

`source` is a configured local canonical repo that `skillctl` may write to.

```bash
skillctl source add my-source --path ~/Workspace/skills-source --install-ref <owner>/<skills-repo>
skillctl source list
skillctl source scan my-source
skillctl source status my-source
skillctl source diff my-source
skillctl source remove my-source
```

### Skill lifecycle

`skill` commands only operate on skills inside a configured source.

```bash
skillctl skill status my-source example-skill
skillctl skill dev my-source example-skill
skillctl skill promote my-source example-skill
skillctl skill adopt my-source new-skill --install
skillctl skill discard my-source example-skill
skillctl skill publish my-source example-skill --push
```

Write operations support `--dry-run` and `--yes` where confirmation is needed. `skillctl` never commits or pushes unless a command explicitly requests it (for example `skill publish --push`).

### Install layer

```bash
skillctl install list
skillctl install list --repo <owner>/<skills-repo>
skillctl install list --source my-source
skillctl install diff my-source
skillctl install sync-new my-source
skillctl install sync-new my-source --from remote
```

### Provider sync

Provider data is read from `npx skills ls -g --json` and known provider directories. Provider configuration is not persisted in `skillctl` config.

```bash
skillctl provider list
skillctl provider list --skill example-skill
skillctl provider status
skillctl provider status --provider claude-code
skillctl provider status --source my-source
skillctl provider diff --skill example-skill
skillctl provider unlink --provider claude-code --skill example-skill
skillctl provider resync --provider claude-code --skill example-skill
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
    "my-source": {
      "path": "~/Workspace/skills-source",
      "remote": "git@github.com:<owner>/<skills-repo>.git",
      "installRef": "<owner>/<skills-repo>",
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
