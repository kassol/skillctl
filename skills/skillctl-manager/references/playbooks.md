# skillctl playbooks

These playbooks are written for an agent guiding a human. In guided mode, perform one step at a time and wait for pasted output.

## Playbook A: first-time setup

1. Confirm tool availability.

```bash
skillctl --version
```

2. Initialize or confirm config.

```bash
skillctl init
skillctl config list
```

3. If the user has a local canonical skill repo, add it as a source.

```bash
skillctl source add <source-name> \
  --path ~/Workspace/skills-source \
  --install-ref <owner>/<skills-repo> \
  --remote git@github.com:<owner>/<skills-repo>.git \
  --agent '*'
```

4. Verify.

```bash
skillctl source list
skillctl source status <source-name>
```

## Playbook B: GitHub repo casing cleanup

Use when `skillctl repo list` shows duplicate-looking GitHub refs that differ only by casing.

1. Read-only inventory:

```bash
skillctl repo list
```

2. Check GitHub canonical `full_name`. Prefer bundled helper:

```bash
python scripts/repo_casing_check.py --skip <private-owner>/<private-repo>
```

3. For each wrong-cased lock entry, identify affected skills. Use `skillctl install list --repo <repo-ref>` for coarse grouping, and inspect lock metadata only if needed. Avoid editing the lockfile.

4. Reinstall affected skills from the canonical repo:

```bash
npx --yes skills add <CanonicalOwner>/<CanonicalRepo> -g --skill <skill-name> --agent '*' -y
```

5. Verify grouping collapsed:

```bash
skillctl repo list | grep -i '<repo-name>'
```

Success criteria: only canonical GitHub casing remains for public repos.

## Playbook C: source/runtime drift

Use when `skillctl source status <source-name>` reports `RUNTIME_DRIFT`.

1. Inspect one skill:

```bash
skillctl skill status <source-name> <skill-name>
```

2. Show promote dry-run diff:

```bash
skillctl skill promote <source-name> <skill-name> --dry-run
```

3. Decide from the diff:

| Situation | Command |
|---|---|
| Runtime is the desired version | `skillctl skill promote <source-name> <skill-name> --yes` |
| Source is the desired version | `skillctl skill discard <source-name> <skill-name>` |
| Neither side is clean | Edit/merge source manually, then `skillctl skill dev <source-name> <skill-name>` |

4. Verify:

```bash
skillctl source status <source-name>
```

If dry-run diff includes backup files or OS metadata, backup first, remove only the non-skill garbage, rerun dry-run, then promote.

## Playbook D: provider anomalies

Use when checking dedicated provider entries.

1. Run safe anomaly filter:

```bash
python scripts/provider_anomalies.py
```

2. Classify each anomaly.

| Status | First question | Typical action |
|---|---|---|
| `PROVIDER_ONLY` | Is it user-authored and worth keeping? | Adopt if yes; remove/unlink if stale |
| `BROKEN_LINK` | Is runtime missing or was source moved? | Resync or unlink |
| `LINK_WRONG_TARGET` | Why does provider point elsewhere? | Resync after confirming expected runtime |
| `COPY_DRIFT` | Should provider copy match runtime? | `skillctl provider resync` |

3. Stale provider-only removal options:

```bash
npx --yes skills remove -g <skill-name> --agent <provider-slug> -y
```

or:

```bash
skillctl provider unlink --provider <provider-slug> --skill <skill-name> --dry-run
skillctl provider unlink --provider <provider-slug> --skill <skill-name> --yes
```

Prefer `npx skills remove` when removing an installed skill from an agent. Prefer `skillctl provider unlink` when cleaning only a dedicated provider entry while preserving global runtime and lockfile.

## Playbook E: adopt a user-authored provider-only skill

Use when a user says a `PROVIDER_ONLY` entry is theirs and should be kept.

1. Confirm it is a valid skill directory.

```bash
find <provider-skill-dir> -maxdepth 2 -type f | sort
test -f <provider-skill-dir>/SKILL.md && sed -n '1,40p' <provider-skill-dir>/SKILL.md
```

2. Backup.

```bash
backup="$HOME/.agents/backups/<skill-name>-provider-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
cp -R <provider-skill-dir> "$backup/<skill-name>-original"
```

3. If the provider dir contains `.DS_Store`, `*.bak*`, or other garbage, create a clean staging dir with only intentional files.

```bash
stage="$HOME/.agents/tmp/<skill-name>-clean"
rm -rf "$stage"
mkdir -p "$stage"
cp <provider-skill-dir>/SKILL.md "$stage/SKILL.md"
# Copy intentional resources only.
```

4. Install clean copy into global runtime.

```bash
npx --yes skills add "$stage" -g --skill <skill-name> --agent '*' -y
```

5. Adopt into source.

```bash
skillctl skill adopt <source-name> <skill-name> --yes
```

6. Reinstall from local source to align runtime content.

```bash
skillctl skill dev <source-name> <skill-name>
```

7. Commit source changes only after user approval.

8. After commit and push, publish from source install ref so lock provenance points at the repo:

```bash
skillctl skill publish <source-name> <skill-name> --push --dry-run
skillctl skill publish <source-name> <skill-name> --push
```

9. Verify:

```bash
skillctl skill status <source-name> <skill-name>
skillctl source status <source-name>
```

Success criteria: `Owned by source: yes`, `Drift: no`, source local count equals installed count for that source.

## Playbook F: final health check

Run after cleanup.

```bash
skillctl repo list
skillctl source status <source-name>
python scripts/provider_anomalies.py
git -C ~/Workspace/skills-source status --short
```

Success criteria:

- No unexpected duplicate repo casing.
- Source `NOT_INSTALLED`, `INSTALLED_ONLY`, and `RUNTIME_DRIFT` are empty.
- Provider anomaly report is empty or contains only intentionally deferred items.
- Local source git is clean or has only user-approved pending changes.
