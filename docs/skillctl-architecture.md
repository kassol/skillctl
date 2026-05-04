# skillctl Architecture

`skillctl` is a command-line companion to `npx skills` for user-level global skills.

## Boundary

`skillctl` owns visibility and local source lifecycle:

- repo list/scan/diff/install-new
- configured local source scan/status/diff
- source skill dev/promote/adopt/discard/publish
- global install list/diff/sync-new
- provider list/status/diff/unlink/resync

`npx skills` remains the installer and provider distribution source of truth. `skillctl` shells out to `npx --yes skills` for installs/resyncs and does not hand-write the global lockfile.

## Data sources

1. User config: `~/.config/skillctl/config.json`
2. Global install store: `~/.agents/skills`
3. Global lockfile: `~/.agents/.skill-lock.json`
4. Provider inventory: `npx skills ls -g --json`
5. Configured local source repos: `sources.<name>.path`
6. Remote snapshots: cached Git clones under `~/.cache/skillctl/repos/`

## Config

Config is user-level only and stores only runtime paths plus configured local sources.

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

Provider registry data is deliberately not persisted. It is read dynamically.

## Source ownership matching

A runtime skill belongs to a configured source when the lock entry matches any of:

- `meta.source == source.installRef`
- `meta.sourceUrl` normalized equals `source.remote`
- `meta.source == source.path`
- `meta.sourceUrl == source.path`

Git refs are normalized across shorthand, SSH, HTTPS, and `.git` suffix forms.

## Safety model

- No project/workspace skill management.
- No direct lockfile writes.
- Installs/resyncs go through `npx skills add ... -g`.
- Write operations support `--dry-run`.
- Destructive operations require confirmation or `--yes`.
- `promote` and `adopt` show/copy runtime content into local source, but do not commit.
- `publish` can push only when explicitly passed `--push`.
- `provider unlink` removes only a dedicated provider entry and never deletes the global store skill.

## Release and Homebrew tap

GitHub releases build macOS arm64/x64 binaries named `skillctl-<tag>-macos-*.tar.gz`. The release workflow renders `skillctl.rb` and commits it to `kassol/homebrew-tap` as `Formula/skillctl.rb`.
