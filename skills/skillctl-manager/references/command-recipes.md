# Command recipes

Use placeholders in examples. Replace them with user-confirmed values only during the live session.

## Setup

```bash
skillctl --version
skillctl init
skillctl config list
```

Add a local source:

```bash
skillctl source add <source-name> \
  --path ~/Workspace/skills-source \
  --install-ref <owner>/<skills-repo> \
  --remote git@github.com:<owner>/<skills-repo>.git \
  --agent '*'
```

## Inspect

```bash
skillctl repo list
skillctl install list
skillctl source list
skillctl source status <source-name>
skillctl source diff <source-name>
skillctl provider status
```

Large JSON output: write to a file before parsing.

```bash
skillctl provider status --json > /tmp/skillctl-provider-status.json
```

## Repo and install layer

```bash
skillctl repo scan <owner>/<skills-repo>
skillctl repo diff <owner>/<skills-repo>
skillctl repo installed <owner>/<skills-repo>
skillctl install list --repo <owner>/<skills-repo>
skillctl install list --source <source-name>
skillctl install diff <source-name>
skillctl install sync-new <source-name> --dry-run
```

## One skill lifecycle

```bash
skillctl skill status <source-name> <skill-name>
skillctl skill dev <source-name> <skill-name>
skillctl skill promote <source-name> <skill-name> --dry-run
skillctl skill promote <source-name> <skill-name> --yes
skillctl skill discard <source-name> <skill-name>
skillctl skill adopt <source-name> <skill-name> --dry-run
skillctl skill adopt <source-name> <skill-name> --yes
skillctl skill publish <source-name> <skill-name> --push --dry-run
skillctl skill publish <source-name> <skill-name> --push
```

## npx skills commands

Install one skill globally from a canonical repo:

```bash
npx --yes skills add <CanonicalOwner>/<CanonicalRepo> -g --skill <skill-name> --agent '*' -y
```

List skills in a repo without installing:

```bash
npx --yes skills add <owner>/<skills-repo> -g --list
```

Install from a local staging directory:

```bash
npx --yes skills add <local-skill-dir> -g --skill <skill-name> --agent '*' -y
```

Remove from one dedicated provider. Put the skill name before `--agent`:

```bash
npx --yes skills remove -g <skill-name> --agent <provider-slug> -y
```

List global inventory:

```bash
npx --yes skills ls -g --json
```

## Provider repair

```bash
skillctl provider status --skill <skill-name>
skillctl provider diff --skill <skill-name>
skillctl provider unlink --provider <provider-slug> --skill <skill-name> --dry-run
skillctl provider unlink --provider <provider-slug> --skill <skill-name> --yes
skillctl provider resync --provider <provider-slug> --skill <skill-name>
```

## Git follow-through for local source

Only run after user approval.

```bash
git -C ~/Workspace/skills-source status --short
git -C ~/Workspace/skills-source diff --check
git -C ~/Workspace/skills-source add <paths>
git -C ~/Workspace/skills-source commit -m "Update managed skills"
skillctl skill publish <source-name> <skill-name> --push --dry-run
skillctl skill publish <source-name> <skill-name> --push
```
