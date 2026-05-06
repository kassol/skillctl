#!/usr/bin/env bun
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import {
  editConfig,
  flattenConfig,
  getConfigPath,
  getConfigValue,
  initConfig,
  parseConfigValue,
  readConfig,
  setConfigValue,
  sourceDefaults,
  unsetConfigValue,
  writeConfig,
} from "./services/config.js";
import { installDiff, repoDiff, sourceDiff, sourceSkillDir } from "./services/diff.js";
import { gitPush, gitStatus } from "./services/git.js";
import { addSkillFromRef, sourceAgents } from "./services/npxSkills.js";
import { printJson, printRows, printSection, statusColor } from "./services/output.js";
import { compactHome } from "./services/paths.js";
import { formatCommand } from "./services/process.js";
import { requireConfirm } from "./services/prompt.js";
import {
  globalSkillDir,
  listProviders,
  providerBySlugOrName,
  providerInventory,
  providerStatuses,
  removableProviderEntry,
} from "./services/providers.js";
import {
  lockEntryMatchesRepo,
  lockEntryMatchesSource,
  resolveRepoSnapshot,
} from "./services/refs.js";
import {
  copySkillDir,
  diffDirectories,
  directoriesEqual,
  parseLockFile,
  parseSkillDir,
  readLockFile,
  scanGlobalStore,
  scanSkillRepo,
} from "./services/scanner.js";
import { APP_NAME, type Config, type SourceConfig } from "./types.js";

const VERSION = "0.2.0";

type CommonOptions = { json?: boolean; dryRun?: boolean; yes?: boolean; agent?: string[] };

const program = new Command();
program
  .name(APP_NAME)
  .description("Repo/source/skill/provider control plane for user-level global AI agent skills")
  .version(`${APP_NAME} ${VERSION}`, "-v, --version")
  .option("--config <path>", "Use an alternate config file")
  .option("--json", "Output JSON where supported");

function globalOptions(): { config?: string; json?: boolean } {
  return program.opts<{ config?: string; json?: boolean }>();
}

function wantsJson(options?: CommonOptions): boolean {
  return Boolean(options?.json || globalOptions().json);
}

async function loadConfig(): Promise<Config> {
  return readConfig(globalOptions().config);
}

function getSource(config: Config, name: string): SourceConfig {
  const source = config.sources[name];
  if (!source) throw new Error(`Unknown source "${name}". Run: ${APP_NAME} source list`);
  return source;
}

function valueForDisplay(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function printDiffObject(diff: {
  remoteOnly?: string[];
  installedOnly?: string[];
  runtimeDrift?: string[];
  localOnly?: string[];
  notInstalled?: string[];
  providerOutOfSync?: Record<string, string[]>;
  warnings?: string[];
}): void {
  if (diff.localOnly) printSection("LOCAL_ONLY", diff.localOnly);
  if (diff.remoteOnly) printSection("REMOTE_ONLY", diff.remoteOnly);
  if (diff.notInstalled) printSection("NOT_INSTALLED", diff.notInstalled);
  if (diff.installedOnly) printSection("INSTALLED_ONLY", diff.installedOnly);
  if (diff.runtimeDrift) printSection("RUNTIME_DRIFT", diff.runtimeDrift);
  if (diff.providerOutOfSync) {
    console.log(pc.bold("PROVIDER_OUT_OF_SYNC"));
    const entries = Object.entries(diff.providerOutOfSync);
    if (!entries.length) console.log("  none");
    for (const [provider, skills] of entries) console.log(`  ${provider}: ${skills.join(", ")}`);
  }
  if (diff.warnings?.length) printSection("WARNINGS", diff.warnings);
}

async function selectedSkillNamesFromFilters(
  config: Config,
  options: { source?: string; repo?: string; skill?: string },
): Promise<string[] | undefined> {
  if (options.skill) return [options.skill];
  if (!options.source && !options.repo) return undefined;
  const lock = await readLockFile(config.runtime.lockFile);
  const runtime = await scanGlobalStore(config.runtime.globalStore, lock);
  if (options.source) {
    const source = getSource(config, options.source);
    return runtime
      .filter((skill) => lockEntryMatchesSource(skill.lock, source))
      .map((skill) => skill.slug);
  }
  if (options.repo) {
    return runtime
      .filter((skill) => lockEntryMatchesRepo(skill.lock, options.repo as string))
      .map((skill) => skill.slug);
  }
  return undefined;
}

function attachWriteOptions(command: Command): Command {
  return command
    .option("--dry-run", "Print planned writes without changing files")
    .option("-y, --yes", "Skip confirmation prompts");
}

program
  .command("init")
  .description("Create ~/.config/skillctl/config.json")
  .option("--force", "Overwrite existing config")
  .action(async (options) => {
    const result = await initConfig(globalOptions().config, options.force);
    if (wantsJson(options)) return printJson(result);
    console.log(`${result.created ? "Created" : "Exists"}: ${result.path}`);
  });

const configCommand = program.command("config").description("Read and edit skillctl config");
configCommand
  .command("list")
  .description("List all config keys")
  .action(async (options) => {
    const config = await loadConfig();
    if (wantsJson(options)) return printJson(config);
    printRows(
      ["Key", "Value"],
      flattenConfig(config).map(([key, value]) => [key, valueForDisplay(value)]),
    );
  });
configCommand
  .command("get")
  .argument("<key>")
  .description("Get a config key")
  .action(async (key, options) => {
    const config = await loadConfig();
    const value = getConfigValue(config, key);
    if (value === undefined) process.exitCode = 1;
    if (wantsJson(options)) return printJson(value ?? null);
    if (value !== undefined) console.log(valueForDisplay(value));
  });
configCommand
  .command("set")
  .argument("<key>")
  .argument("<value>")
  .description("Set a config key")
  .action(async (key, rawValue, options) => {
    const config = await loadConfig();
    const next = setConfigValue(config, key, parseConfigValue(rawValue));
    await writeConfig(globalOptions().config, next);
    if (wantsJson(options)) return printJson(next);
    console.log(`Set ${key}`);
  });
configCommand
  .command("unset")
  .argument("<key>")
  .description("Unset a config key")
  .action(async (key, options) => {
    const config = await loadConfig();
    const next = unsetConfigValue(config, key);
    await writeConfig(globalOptions().config, next);
    if (wantsJson(options)) return printJson(next);
    console.log(`Unset ${key}`);
  });
configCommand
  .command("edit")
  .description("Open config in $EDITOR")
  .action(() => {
    editConfig(globalOptions().config);
  });

const repoCommand = program
  .command("repo")
  .description("Inspect npx skills installable repos/packages");
repoCommand
  .command("list")
  .description("List installed repos grouped from global lockfile")
  .action(async (options) => {
    const config = await loadConfig();
    const lock = await readLockFile(config.runtime.lockFile);
    const groups = parseLockFile(lock);
    const rows = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([repo, skills]) => [repo, skills.length]);
    if (wantsJson(options))
      return printJson(rows.map(([repo, installed]) => ({ repo, installed })));
    printRows(["Repo", "Installed"], rows);
  });
repoCommand
  .command("scan")
  .argument("<repo-ref>")
  .description("Scan all skills in a local or remote repo")
  .action(async (repoRef, options) => {
    const snapshot = await resolveRepoSnapshot(repoRef);
    const skills = await scanSkillRepo(snapshot.path);
    if (wantsJson(options)) return printJson({ repo: repoRef, path: snapshot.path, skills });
    console.log(`${pc.bold("Repo:")} ${repoRef}`);
    console.log(`${pc.bold("Path:")} ${compactHome(snapshot.path)}`);
    printRows(
      ["Skill", "Description", "Path"],
      skills.map((skill) => [skill.slug, skill.description, skill.relativeDir]),
    );
  });
repoCommand
  .command("diff")
  .argument("<repo-ref>")
  .description("Diff repo skills against the global install layer")
  .action(async (repoRef, options) => {
    const diff = await repoDiff(await loadConfig(), repoRef);
    if (wantsJson(options)) return printJson(diff);
    console.log(`${pc.bold("Repo:")} ${diff.repo}`);
    console.log(`REMOTE_TOTAL:     ${diff.repoTotal}`);
    console.log(`INSTALLED_TOTAL:  ${diff.installedTotal}`);
    printDiffObject(diff);
  });
repoCommand
  .command("installed")
  .argument("<repo-ref>")
  .description("List globally installed skills owned by a repo ref")
  .action(async (repoRef, options) => {
    const config = await loadConfig();
    const lock = await readLockFile(config.runtime.lockFile);
    const runtime = await scanGlobalStore(config.runtime.globalStore, lock);
    const skills = runtime.filter((skill) => lockEntryMatchesRepo(skill.lock, repoRef));
    if (wantsJson(options)) return printJson(skills);
    printRows(
      ["Skill", "Path"],
      skills.map((skill) => [skill.slug, compactHome(skill.dir)]),
    );
  });
attachWriteOptions(
  repoCommand
    .command("install-new")
    .argument("<repo-ref>")
    .description("Install repo skills missing from the global store"),
)
  .option("--agent <agents...>", "Agents to sync via npx skills", ["*"])
  .action(async (repoRef, options: CommonOptions) => {
    const config = await loadConfig();
    const diff = await repoDiff(config, repoRef);
    if (diff.remoteOnly.length === 0) {
      console.log("No new skills to install.");
      return;
    }
    await requireConfirm(
      `Install ${diff.remoteOnly.length} new skill(s) from ${repoRef}?`,
      options.yes || options.dryRun,
    );
    const results = [];
    for (const skill of diff.remoteOnly) {
      const result = await addSkillFromRef(config, repoRef, skill, options.agent ?? ["*"], {
        dryRun: options.dryRun,
        passthrough: !options.dryRun,
      });
      results.push({ skill, command: formatCommand(result.command), code: result.code });
      if (result.code !== 0) throw new Error(result.stderr || `Failed to install ${skill}`);
      if (options.dryRun) console.log(result.stdout.trim());
    }
    if (wantsJson(options)) return printJson(results);
  });

const sourceCommand = program
  .command("source")
  .description("Manage configured local canonical skill repos");
sourceCommand
  .command("add")
  .argument("<name>")
  .requiredOption("--path <path>", "Local source repo path")
  .requiredOption("--install-ref <ref>", "npx skills install ref, e.g. owner/repo")
  .option("--remote <remote>", "Git remote URL")
  .option("--agent <agents...>", "Default agents for this source", ["*"])
  .option("--publish-branch <branch>", "Publish branch", "main")
  .option("--full-depth", "Use full-depth npx skills scans for this source", false)
  .description("Add or replace a configured source")
  .action(async (name, options) => {
    const config = await loadConfig();
    config.sources[name] = sourceDefaults({
      path: options.path,
      installRef: options.installRef,
      remote: options.remote,
      defaultAgents: options.agent,
      publishBranch: options.publishBranch,
      fullDepth: options.fullDepth,
    });
    await writeConfig(globalOptions().config, config);
    if (wantsJson(options)) return printJson(config.sources[name]);
    console.log(`Added source ${name}`);
  });
attachWriteOptions(
  sourceCommand.command("remove").argument("<name>").description("Remove a source from config"),
).action(async (name, options: CommonOptions) => {
  const config = await loadConfig();
  getSource(config, name);
  await requireConfirm(`Remove source ${name} from config?`, options.yes || options.dryRun);
  delete config.sources[name];
  if (!options.dryRun) await writeConfig(globalOptions().config, config);
  if (wantsJson(options)) return printJson({ removed: name, dryRun: Boolean(options.dryRun) });
  console.log(options.dryRun ? `Would remove source ${name}` : `Removed source ${name}`);
});
sourceCommand
  .command("list")
  .description("List configured sources")
  .action(async (options) => {
    const config = await loadConfig();
    const rows = Object.entries(config.sources).map(([name, source]) => [
      name,
      compactHome(source.path),
      source.installRef,
      source.defaultAgents.join(","),
    ]);
    if (wantsJson(options)) return printJson(config.sources);
    printRows(["Source", "Path", "Install Ref", "Agents"], rows);
  });
sourceCommand
  .command("scan")
  .argument("<name>")
  .description("Scan skills in a configured source")
  .action(async (name, options) => {
    const config = await loadConfig();
    const source = getSource(config, name);
    const skills = await scanSkillRepo(source.path);
    if (wantsJson(options)) return printJson({ source: name, skills });
    printRows(
      ["Skill", "Description", "Path"],
      skills.map((skill) => [skill.slug, skill.description, skill.relativeDir]),
    );
  });
sourceCommand
  .command("status")
  .argument("<name>")
  .description("Show local/git/install status for a source")
  .action(async (name, options) => {
    const config = await loadConfig();
    const source = getSource(config, name);
    const [git, diff] = await Promise.all([gitStatus(source.path), installDiff(config, source)]);
    const result = { source: name, config: source, git, install: diff };
    if (wantsJson(options)) return printJson(result);
    console.log(`${pc.bold("Source:")} ${name}`);
    console.log(`Path:        ${compactHome(source.path)}`);
    console.log(`InstallRef:  ${source.installRef}`);
    console.log(`Remote:      ${source.remote ?? ""}`);
    console.log(
      `Git:         ${git.ok ? `${git.branch}${git.dirty ? " (dirty)" : ""}` : "not a git repo"}`,
    );
    console.log(`Local:       ${diff.sourceTotal}`);
    console.log(`Installed:   ${diff.installedTotal}`);
    printDiffObject(diff);
  });
sourceCommand
  .command("diff")
  .argument("<name>")
  .option("--no-remote", "Skip remote snapshot comparison")
  .description("Diff local source, remote installRef, global store, and providers")
  .action(async (name, options) => {
    const config = await loadConfig();
    const source = getSource(config, name);
    const diff = await sourceDiff(config, name, source, { includeRemote: options.remote });
    if (wantsJson(options)) return printJson(diff);
    console.log(`${pc.bold("Source:")} ${name}`);
    console.log(`LOCAL_TOTAL:      ${diff.localTotal}`);
    if (diff.remoteTotal !== undefined) console.log(`REMOTE_TOTAL:     ${diff.remoteTotal}`);
    console.log(`INSTALLED_TOTAL:  ${diff.installedTotal}`);
    printDiffObject(diff);
  });

const skillCommand = program
  .command("skill")
  .description("Manage the lifecycle of a skill inside a configured source");
skillCommand
  .command("status")
  .argument("<source>")
  .argument("<skill>")
  .description("Show source/runtime/provider status for one skill")
  .action(async (sourceName, skillName, options) => {
    const config = await loadConfig();
    const source = getSource(config, sourceName);
    const sourceDir = await sourceSkillDir(source, skillName);
    const sourceManifest = sourceDir ? await parseSkillDir(sourceDir, source.path) : null;
    const runtimeDir = globalSkillDir(config, skillName);
    const runtimeManifest = await parseSkillDir(runtimeDir, config.runtime.globalStore);
    const lock = await readLockFile(config.runtime.lockFile);
    const lockEntry = lock?.skills?.[skillName];
    const drift =
      sourceManifest && runtimeManifest
        ? !(await directoriesEqual(sourceManifest.dir, runtimeManifest.dir))
        : undefined;
    const providers = await providerStatuses(config, { skills: [skillName] });
    const result = {
      source: sourceName,
      skill: skillName,
      sourceManifest,
      runtimeManifest,
      lockEntry,
      ownedBySource: lockEntryMatchesSource(lockEntry, source),
      drift,
      providers,
    };
    if (wantsJson(options)) return printJson(result);
    console.log(`${pc.bold("Skill:")} ${skillName}`);
    console.log(`Source dir:      ${sourceManifest ? compactHome(sourceManifest.dir) : "missing"}`);
    console.log(
      `Runtime dir:     ${runtimeManifest ? compactHome(runtimeManifest.dir) : "missing"}`,
    );
    console.log(`Lock source:     ${lockEntry?.source ?? "missing"}`);
    console.log(`Owned by source: ${lockEntryMatchesSource(lockEntry, source) ? "yes" : "no"}`);
    console.log(`Drift:           ${drift === undefined ? "n/a" : drift ? "yes" : "no"}`);
    printRows(
      ["Provider", "Status", "Detail"],
      providers.flatMap((provider) =>
        provider.statuses.map((item) => [provider.provider.slug, item.status, item.detail ?? ""]),
      ),
    );
  });
skillCommand
  .command("dev")
  .argument("<source>")
  .argument("<skill>")
  .option("--agent <agents...>", "Override agents")
  .option("--dry-run", "Print npx command")
  .description("Install a source skill from local source.path via npx skills")
  .action(async (sourceName, skillName, options: CommonOptions) => {
    const config = await loadConfig();
    const source = getSource(config, sourceName);
    const result = await addSkillFromRef(
      config,
      source.path,
      skillName,
      sourceAgents(source, options.agent),
      { dryRun: options.dryRun, passthrough: !options.dryRun },
    );
    if (options.dryRun) console.log(result.stdout.trim());
    if (result.code !== 0) throw new Error(result.stderr || `Failed to install ${skillName}`);
  });
attachWriteOptions(
  skillCommand
    .command("promote")
    .argument("<source>")
    .argument("<skill>")
    .description("Copy runtime ~/.agents/skills/<skill> back into source.path/<skill>"),
).action(async (sourceName, skillName, options: CommonOptions) => {
  const config = await loadConfig();
  const source = getSource(config, sourceName);
  const sourceDir = await sourceSkillDir(source, skillName);
  const runtimeDir = globalSkillDir(config, skillName);
  const runtimeManifest = await parseSkillDir(runtimeDir, config.runtime.globalStore);
  if (!runtimeManifest)
    throw new Error(`Runtime skill ${skillName} does not exist in ${config.runtime.globalStore}`);
  const patch = await diffDirectories(sourceDir as string, runtimeDir, "source", "runtime");
  if (patch.trim()) console.log(patch);
  else console.log("No content diff.");
  await requireConfirm(
    `Promote runtime ${skillName} into source ${sourceName}?`,
    options.yes || options.dryRun,
  );
  if (!options.dryRun) await copySkillDir(runtimeDir, sourceDir as string);
  const git = await gitStatus(source.path);
  if (git.ok && git.output) console.log(git.output);
});
attachWriteOptions(
  skillCommand
    .command("adopt")
    .argument("<source>")
    .argument("<skill>")
    .option("--install", "Run local npx skills add after copying")
    .option("--force", "Overwrite an existing source skill")
    .description("Copy a runtime-only skill into a configured source"),
).action(
  async (
    sourceName,
    skillName,
    options: CommonOptions & { install?: boolean; force?: boolean },
  ) => {
    const config = await loadConfig();
    const source = getSource(config, sourceName);
    const sourceDir = join(source.path, skillName);
    const runtimeDir = globalSkillDir(config, skillName);
    const runtimeManifest = await parseSkillDir(runtimeDir, config.runtime.globalStore);
    if (!runtimeManifest)
      throw new Error(`Runtime skill ${skillName} does not exist in ${config.runtime.globalStore}`);
    const existing = await parseSkillDir(sourceDir, source.path);
    if (existing && !options.force)
      throw new Error(`${compactHome(sourceDir)} already exists. Use --force to overwrite.`);
    await requireConfirm(
      `Adopt runtime ${skillName} into ${compactHome(sourceDir)}?`,
      options.yes || options.dryRun,
    );
    if (!options.dryRun) await copySkillDir(runtimeDir, sourceDir);
    if (options.install) {
      const result = await addSkillFromRef(
        config,
        source.path,
        skillName,
        sourceAgents(source, options.agent),
        { dryRun: options.dryRun, passthrough: !options.dryRun },
      );
      if (options.dryRun) console.log(result.stdout.trim());
      if (result.code !== 0) throw new Error(result.stderr || `Failed to install ${skillName}`);
    }
  },
);
skillCommand
  .command("discard")
  .argument("<source>")
  .argument("<skill>")
  .option("--agent <agents...>", "Override agents")
  .option("--dry-run", "Print npx command")
  .description("Discard runtime drift by reinstalling from local source.path")
  .action(async (sourceName, skillName, options: CommonOptions) => {
    const config = await loadConfig();
    const source = getSource(config, sourceName);
    const result = await addSkillFromRef(
      config,
      source.path,
      skillName,
      sourceAgents(source, options.agent),
      { dryRun: options.dryRun, passthrough: !options.dryRun },
    );
    if (options.dryRun) console.log(result.stdout.trim());
    if (result.code !== 0) throw new Error(result.stderr || `Failed to discard ${skillName}`);
  });
skillCommand
  .command("publish")
  .argument("<source>")
  .argument("<skill>")
  .option("--push", "git push origin publishBranch before reinstalling from installRef")
  .option("--allow-dirty", "Allow publishing with dirty source git status")
  .option("--agent <agents...>", "Override agents")
  .option("--dry-run", "Print npx/git commands")
  .description("Publish by optionally pushing source and reinstalling from remote installRef")
  .action(
    async (
      sourceName,
      skillName,
      options: CommonOptions & { push?: boolean; allowDirty?: boolean },
    ) => {
      const config = await loadConfig();
      const source = getSource(config, sourceName);
      const git = await gitStatus(source.path);
      if (git.ok && git.dirty && !options.allowDirty)
        throw new Error("Source git status is dirty. Commit/stash changes or use --allow-dirty.");
      if (options.push) {
        if (options.dryRun)
          console.log(`git -C ${source.path} push origin ${source.publishBranch}`);
        else await gitPush(source.path, source.publishBranch);
      }
      const result = await addSkillFromRef(
        config,
        source.installRef,
        skillName,
        sourceAgents(source, options.agent),
        { dryRun: options.dryRun, passthrough: !options.dryRun },
      );
      if (options.dryRun) console.log(result.stdout.trim());
      if (result.code !== 0) throw new Error(result.stderr || `Failed to publish ${skillName}`);
    },
  );

const installCommand = program
  .command("install")
  .description("Inspect and sync the user-level global install layer");
installCommand
  .command("list")
  .option("--repo <repo-ref>")
  .option("--source <source>")
  .description("List globally installed skills")
  .action(async (options) => {
    const config = await loadConfig();
    const lock = await readLockFile(config.runtime.lockFile);
    let runtime = await scanGlobalStore(config.runtime.globalStore, lock);
    if (options.repo)
      runtime = runtime.filter((skill) => lockEntryMatchesRepo(skill.lock, options.repo));
    if (options.source)
      runtime = runtime.filter((skill) =>
        lockEntryMatchesSource(skill.lock, getSource(config, options.source)),
      );
    if (wantsJson(options)) return printJson(runtime);
    printRows(
      ["Skill", "Source", "Path"],
      runtime.map((skill) => [skill.slug, skill.lock?.source ?? "", compactHome(skill.dir)]),
    );
  });
installCommand
  .command("diff")
  .argument("<source>")
  .description("Diff a source against the global install layer")
  .action(async (sourceName, options) => {
    const config = await loadConfig();
    const diff = await installDiff(config, getSource(config, sourceName));
    if (wantsJson(options)) return printJson(diff);
    console.log(`${pc.bold("Source:")} ${sourceName}`);
    console.log(`SOURCE_TOTAL:     ${diff.sourceTotal}`);
    console.log(`INSTALLED_TOTAL:  ${diff.installedTotal}`);
    printDiffObject(diff);
  });
attachWriteOptions(
  installCommand
    .command("sync-new")
    .argument("<source>")
    .option(
      "--from <local|remote>",
      "Install from local source.path or remote installRef",
      "remote",
    )
    .option("--agent <agents...>", "Override agents")
    .description("Install source skills missing from the global store"),
).action(async (sourceName, options: CommonOptions & { from: "local" | "remote" }) => {
  const config = await loadConfig();
  const source = getSource(config, sourceName);
  const diff = await installDiff(config, source);
  if (diff.notInstalled.length === 0) {
    console.log("No missing skills to install.");
    return;
  }
  const ref = options.from === "remote" ? source.installRef : source.path;
  await requireConfirm(
    `Install ${diff.notInstalled.length} missing skill(s) from ${ref}?`,
    options.yes || options.dryRun,
  );
  for (const skill of diff.notInstalled) {
    const result = await addSkillFromRef(config, ref, skill, sourceAgents(source, options.agent), {
      dryRun: options.dryRun,
      passthrough: !options.dryRun,
    });
    if (options.dryRun) console.log(result.stdout.trim());
    if (result.code !== 0) throw new Error(result.stderr || `Failed to install ${skill}`);
  }
});

const providerCommand = program
  .command("provider")
  .description("Inspect and repair npx skills provider sync");
providerCommand
  .command("list")
  .option("--skill <skill>")
  .description("List providers from npx skills inventory plus known checkable dirs")
  .action(async (options) => {
    const config = await loadConfig();
    if (options.skill) {
      const inventory = await providerInventory(config);
      const found = inventory.find((item) => item.name === options.skill);
      const rows = (found?.agents ?? []).map((agent) => [agent]);
      if (wantsJson(options)) return printJson(found ?? null);
      printRows(["Provider"], rows);
      return;
    }
    const providers = await listProviders(config);
    if (wantsJson(options)) return printJson(providers);
    printRows(
      ["Provider", "Name", "Type", "Dir", "Skills"],
      providers.map((provider) => [
        provider.slug,
        provider.displayName,
        provider.type,
        provider.dir ? compactHome(provider.dir) : "",
        provider.skills,
      ]),
    );
  });
providerCommand
  .command("status")
  .option("--provider <provider>")
  .option("--source <source>")
  .option("--repo <repo-ref>")
  .option("--skill <skill>")
  .description("Check provider list/symlink/copy sync against ~/.agents/skills")
  .action(async (options) => {
    const config = await loadConfig();
    const provider = options.provider ? providerBySlugOrName(config, options.provider) : undefined;
    if (options.provider && !provider) throw new Error(`Unknown provider ${options.provider}`);
    const skills = await selectedSkillNamesFromFilters(config, options);
    const statuses = await providerStatuses(config, { provider: provider?.slug, skills });
    if (wantsJson(options)) return printJson(statuses);
    for (const item of statuses) {
      console.log(pc.bold(item.provider.displayName));
      console.log(`  type: ${item.provider.type}`);
      if (item.provider.dir) console.log(`  dir:  ${compactHome(item.provider.dir)}`);
      printRows(
        ["Skill", "Status", "Detail"],
        item.statuses.map((status) => [
          status.skill,
          statusColor(status.status),
          status.detail ?? "",
        ]),
      );
      console.log("");
    }
  });
providerCommand
  .command("diff")
  .option("--provider <provider>")
  .option("--source <source>")
  .option("--repo <repo-ref>")
  .option("--skill <skill>")
  .description("Show provider content sync state for selected skills")
  .action(async (options) => {
    const config = await loadConfig();
    const provider = options.provider ? providerBySlugOrName(config, options.provider) : undefined;
    if (options.provider && !provider) throw new Error(`Unknown provider ${options.provider}`);
    const skills = await selectedSkillNamesFromFilters(config, options);
    const statuses = await providerStatuses(config, { provider: provider?.slug, skills });
    if (wantsJson(options)) return printJson(statuses);
    for (const item of statuses) {
      console.log(pc.bold(`${item.provider.displayName} (${item.provider.type})`));
      printRows(
        ["Skill", "Status", "Detail"],
        item.statuses.map((status) => [
          status.skill,
          statusColor(status.status),
          status.detail ?? "",
        ]),
      );
      console.log("");
    }
  });
attachWriteOptions(
  providerCommand
    .command("unlink")
    .requiredOption("--provider <provider>")
    .requiredOption("--skill <skill>")
    .description("Remove only a dedicated provider entry; keep global store and lockfile"),
).action(async (options: CommonOptions & { provider: string; skill: string }) => {
  const config = await loadConfig();
  const provider = providerBySlugOrName(config, options.provider);
  if (!provider) throw new Error(`Unknown provider ${options.provider}`);
  const entry = await removableProviderEntry(config, provider, options.skill);
  await requireConfirm(
    `Delete provider entry ${compactHome(entry)}?`,
    options.yes || options.dryRun,
  );
  if (!options.dryRun) await rm(entry, { recursive: true, force: true });
  if (wantsJson(options))
    return printJson({
      provider: provider.slug,
      skill: options.skill,
      removed: entry,
      dryRun: Boolean(options.dryRun),
    });
  console.log(
    options.dryRun ? `Would delete ${compactHome(entry)}` : `Deleted ${compactHome(entry)}`,
  );
});
providerCommand
  .command("resync")
  .requiredOption("--provider <provider>")
  .requiredOption("--skill <skill>")
  .option("--repo <repo-ref>", "Fallback repo ref when skill is not in config or lockfile")
  .option("--dry-run", "Print npx command")
  .description("Repair a provider entry through npx skills add")
  .action(async (options: CommonOptions & { provider: string; skill: string; repo?: string }) => {
    const config = await loadConfig();
    const provider = providerBySlugOrName(config, options.provider);
    if (!provider) throw new Error(`Unknown provider ${options.provider}`);
    let ref = options.repo;
    for (const source of Object.values(config.sources)) {
      const skills = await scanSkillRepo(source.path);
      if (skills.some((skill) => skill.slug === options.skill || skill.name === options.skill)) {
        ref = source.path;
        break;
      }
    }
    if (!ref) {
      const lock = await readLockFile(config.runtime.lockFile);
      ref = lock?.skills?.[options.skill]?.source;
    }
    if (!ref) throw new Error(`Cannot infer source for ${options.skill}; pass --repo <repo-ref>.`);
    const result = await addSkillFromRef(config, ref, options.skill, [provider.slug], {
      dryRun: options.dryRun,
      passthrough: !options.dryRun,
    });
    if (options.dryRun) console.log(result.stdout.trim());
    if (result.code !== 0) throw new Error(result.stderr || `Failed to resync ${options.skill}`);
  });

program.hook("preAction", async () => {
  // Ensure config path is resolvable early for clearer error messages in config edit/list flows.
  getConfigPath(globalOptions().config);
});

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(pc.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
  process.exit(1);
});
