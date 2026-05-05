# skillctl mental model

`skillctl` is a control plane for user-level global skills. It complements `npx skills`; it does not replace it.

## Layers

```text
Upstream repo
  ↓ install/update through npx skills
Local source repo
  ↓ dev/promote/adopt/publish through skillctl
Global runtime: ~/.agents/skills
  ↓ provider sync/symlink/copy
Provider entries: ~/.claude/skills, ~/.codex/skills, ...
```

## Layer responsibilities

| Layer | Purpose | Should be source of truth? |
|---|---|---|
| Upstream repo | Canonical third-party skill package | Yes for third-party skills |
| Local source repo | User-maintained canonical skill repo | Yes for user-authored or modified skills |
| `~/.agents/skills` | Global runtime install layer | No |
| Provider entries | Agent-specific distribution entries | No |

## Source-of-truth rules

1. Third-party skill unchanged from a public repo → upstream repo is truth.
2. User-authored skill → configured local source repo is truth.
3. Modified third-party skill intended to persist → first adopt or promote into local source.
4. Runtime-only skill with no source → treat as temporary until adopted or discarded.
5. Provider-only skill → investigate before deletion; it may be a user-created skill that has not been adopted yet.

## Common status meanings

| Status | Meaning | Typical action |
|---|---|---|
| `NOT_INSTALLED` | Source has a skill missing from runtime | `skillctl skill dev` or `skillctl install sync-new` |
| `INSTALLED_ONLY` | Runtime has a source-owned skill missing from source | Adopt, remove, or reinstall from correct source |
| `RUNTIME_DRIFT` | Source and runtime content differ | Inspect diff; promote or discard |
| `PROVIDER_ONLY` | Dedicated provider has entry missing from runtime | Adopt if user-owned; remove if stale |
| `BROKEN_LINK` | Provider symlink target missing | Resync or unlink |
| `LINK_WRONG_TARGET` | Provider symlink points somewhere unexpected | Resync or unlink |
| `COPY_DRIFT` | Provider copy differs from runtime | Resync provider |

## Why manual lockfile edits are discouraged

The lockfile records installation provenance. If it is edited by hand, provider state, runtime content, and source ownership can diverge silently. Prefer command flows that make the installed content match the recorded provenance:

- `npx skills add <canonical-repo> ...` for upstream provenance.
- `skillctl skill dev <source> <skill>` for local source runtime sync.
- `skillctl skill publish <source> <skill> --push` for remote install provenance after source changes are committed and pushed.
