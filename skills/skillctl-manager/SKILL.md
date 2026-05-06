---
name: skillctl-manager
description: >-
  Agent workflow for managing user-level global AI agent skills with skillctl and npx skills. Use whenever the user asks to create a new skill, develop and iterate on skills, clean up skills, audit installed skills, configure local skill sources, fix GitHub repo source casing, resolve source/runtime drift, adopt/promote/discard/publish skills, repair provider-only or broken provider entries, or wants step-by-step skill hygiene. Prefer this skill over ad-hoc lockfile edits; it enforces dry-runs, backups, source-of-truth checks, privacy-safe examples, and one-step-at-a-time cleanup.
---

# skillctl-manager

Use this skill as an agent-facing operations manual for `skillctl`. The human should not need to remember command details; guide them through safe checks and command-driven fixes.

## Core model

Think in four layers:

1. **Upstream repo** — public or private installable repo, usually a GitHub `owner/repo` ref.
2. **Local source** — configured canonical repo that `skillctl` may write to.
3. **Global runtime** — `~/.agents/skills`, the installed copy used directly by native-global providers.
4. **Provider entries** — dedicated agent dirs such as `~/.claude/skills` or `~/.codex/skills`, usually symlinks or copies.

Default truth rules:

- Third-party skills use the upstream repo as source of truth.
- User-authored or modified skills should live in a configured local source repo.
- `~/.agents/skills` is an install/runtime layer, not long-term truth.
- Provider entries are distribution artifacts, not canonical source.

Read `references/model.md` when the user needs the mental model explained.

## Safety rules

- Prefer `skillctl` and `npx skills` commands over manual edits.
- Do not edit `~/.agents/.skill-lock.json` directly unless the user explicitly overrides this rule.
- Use `--dry-run` before writes where supported.
- Backup before file-level cleanup.
- Do not commit or push unless the user explicitly asks for that step.
- Do not reveal personal paths, private repo names, or private skill names in examples. Use placeholders.
- For large `skillctl ... --json` output, redirect to a temp file before parsing.

## First response protocol

If the user wants guided cleanup, especially says “one step at a time”:

1. Give exactly one command group.
2. Explain what that step checks or changes.
3. Ask the user to paste output.
4. Decide the next step only after seeing output.
5. Keep destructive actions behind explicit confirmation or dry-run.

If the user asks for an audit report, run read-only checks first and summarize issues by category.

## Standard audit order

1. Confirm `skillctl` is installed: `skillctl --version`.
2. Confirm config exists: `skillctl init` then `skillctl config list`.
3. Inspect repo grouping: `skillctl repo list`.
4. Check GitHub canonical casing when duplicate-looking repos appear.
5. Inspect configured sources: `skillctl source list` and `skillctl source status <source-name>`.
6. Inspect provider anomalies with a temp JSON file.
7. Triage runtime-only or provider-only skills.

Detailed procedures live in `references/playbooks.md`.

## Common decisions

### Repo casing conflict

If the same GitHub repo appears with different casing, verify canonical casing with GitHub metadata, then reinstall affected skills from the canonical ref through `npx skills`. Do not patch the lockfile by hand.

### Source/runtime drift

Use:

```bash
skillctl skill status <source-name> <skill-name>
skillctl skill promote <source-name> <skill-name> --dry-run
```

Then choose:

- Runtime is newer and should be kept → `skillctl skill promote <source-name> <skill-name> --yes`
- Source is correct and runtime drift should be discarded → `skillctl skill discard <source-name> <skill-name>`
- Neither side is clean → merge in source, then reinstall with `skillctl skill dev <source-name> <skill-name>`

### Provider-only entry

Investigate before deleting. If it is user-authored, preserve and adopt it into a source. If it is an invalid stale entry, remove it through `npx skills remove` or `skillctl provider unlink`.

Remember `npx skills remove --agent` consumes multiple following args. Put skill names before `--agent`:

```bash
npx --yes skills remove -g <skill-name> --agent <provider-slug> -y
```

## Useful bundled helpers

Resolve helper paths relative to this skill directory before running them.

- `scripts/repo_casing_check.py` — checks `skillctl repo list --json` against GitHub canonical `full_name`.
- `scripts/provider_anomalies.py` — safely collects and filters provider-only/broken/drift statuses.

Read `references/command-recipes.md` for copyable command recipes.

## Privacy requirement

All examples and test prompts must be generic. Use placeholder names such as `<owner>/<skills-repo>`, `<source-name>`, `<skill-name>`, `<provider-slug>`, and `~/Workspace/skills-source`. Never copy user-specific names from a live cleanup session into public skill files.
