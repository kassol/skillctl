import { join } from "node:path";
import type { Config, RepoDiff, RuntimeSkill, SourceConfig, SourceDiff } from "../types.js";
import { providerOutOfSyncBySkill } from "./providers.js";
import { lockEntryMatchesRepo, lockEntryMatchesSource, resolveRepoSnapshot } from "./refs.js";
import { directoriesEqual, readLockFile, scanGlobalStore, scanSkillRepo } from "./scanner.js";

function bySlug<T extends { slug: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.slug, item]));
}

function sorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function runtimeForRepo(runtime: RuntimeSkill[], repoRef: string): RuntimeSkill[] {
  return runtime.filter((skill) => lockEntryMatchesRepo(skill.lock, repoRef));
}

function runtimeForSource(runtime: RuntimeSkill[], source: SourceConfig): RuntimeSkill[] {
  return runtime.filter((skill) => lockEntryMatchesSource(skill.lock, source));
}

export async function repoDiff(config: Config, repoRef: string): Promise<RepoDiff> {
  const warnings: string[] = [];
  const lock = await readLockFile(config.runtime.lockFile);
  const runtime = await scanGlobalStore(config.runtime.globalStore, lock);
  let repoPath: string;
  try {
    repoPath = (await resolveRepoSnapshot(repoRef)).path;
  } catch (err) {
    throw new Error(
      `Unable to scan ${repoRef}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const repoSkills = await scanSkillRepo(repoPath);
  const repoMap = bySlug(repoSkills);
  const runtimeMap = bySlug(runtime);
  const installedForRepo = runtimeForRepo(runtime, repoRef);
  const installedForRepoMap = bySlug(installedForRepo);

  const remoteOnly = sorted(
    repoSkills.map((skill) => skill.slug).filter((name) => !runtimeMap.has(name)),
  );
  const installedOnly = sorted(
    installedForRepo.map((skill) => skill.slug).filter((name) => !repoMap.has(name)),
  );

  const runtimeDrift: string[] = [];
  for (const [name, repoSkill] of repoMap.entries()) {
    const installed = runtimeMap.get(name);
    if (!installed) continue;
    if (!(await directoriesEqual(repoSkill.dir, installed.dir))) runtimeDrift.push(name);
  }

  return {
    repo: repoRef,
    repoTotal: repoSkills.length,
    installedTotal: installedForRepoMap.size,
    remoteOnly,
    installedOnly,
    runtimeDrift: sorted(runtimeDrift),
    warnings,
  };
}

export async function sourceDiff(
  config: Config,
  sourceName: string,
  source: SourceConfig,
  options: { includeRemote?: boolean } = {},
): Promise<SourceDiff> {
  const warnings: string[] = [];
  const lock = await readLockFile(config.runtime.lockFile);
  const runtime = await scanGlobalStore(config.runtime.globalStore, lock);
  const localSkills = await scanSkillRepo(source.path);
  const localMap = bySlug(localSkills);
  const runtimeOwned = runtimeForSource(runtime, source);
  const runtimeMap = bySlug(runtime);
  const runtimeOwnedMap = bySlug(runtimeOwned);

  let remoteTotal: number | undefined;
  let localOnly: string[] = [];
  let remoteOnly: string[] = [];
  if (options.includeRemote !== false) {
    try {
      const remotePath = (
        await resolveRepoSnapshot(source.installRef, { fullDepth: source.fullDepth })
      ).path;
      const remoteSkills = await scanSkillRepo(remotePath);
      const remoteMap = bySlug(remoteSkills);
      remoteTotal = remoteSkills.length;
      localOnly = sorted(
        localSkills.map((skill) => skill.slug).filter((name) => !remoteMap.has(name)),
      );
      remoteOnly = sorted(
        remoteSkills.map((skill) => skill.slug).filter((name) => !localMap.has(name)),
      );
    } catch (err) {
      warnings.push(`Remote scan skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const notInstalled = sorted(
    localSkills.map((skill) => skill.slug).filter((name) => !runtimeMap.has(name)),
  );
  const installedOnly = sorted(
    runtimeOwned.map((skill) => skill.slug).filter((name) => !localMap.has(name)),
  );
  const runtimeDrift: string[] = [];
  for (const [name, localSkill] of localMap.entries()) {
    const runtimeSkill = runtimeMap.get(name);
    if (!runtimeSkill) continue;
    if (!(await directoriesEqual(localSkill.dir, runtimeSkill.dir))) runtimeDrift.push(name);
  }

  const providerOutOfSync = await providerOutOfSyncBySkill(config, sorted(localMap.keys()));

  return {
    source: sourceName,
    localTotal: localSkills.length,
    remoteTotal,
    installedTotal: runtimeOwnedMap.size,
    localOnly,
    remoteOnly,
    notInstalled,
    installedOnly,
    runtimeDrift: sorted(runtimeDrift),
    providerOutOfSync,
    warnings,
  };
}

export async function installDiff(
  config: Config,
  source: SourceConfig,
): Promise<{
  sourceTotal: number;
  installedTotal: number;
  notInstalled: string[];
  installedOnly: string[];
  runtimeDrift: string[];
}> {
  const lock = await readLockFile(config.runtime.lockFile);
  const runtime = await scanGlobalStore(config.runtime.globalStore, lock);
  const sourceSkills = await scanSkillRepo(source.path);
  const sourceMap = bySlug(sourceSkills);
  const runtimeMap = bySlug(runtime);
  const runtimeOwned = runtimeForSource(runtime, source);

  const runtimeDrift: string[] = [];
  for (const [name, sourceSkill] of sourceMap.entries()) {
    const runtimeSkill = runtimeMap.get(name);
    if (!runtimeSkill) continue;
    if (!(await directoriesEqual(sourceSkill.dir, runtimeSkill.dir))) runtimeDrift.push(name);
  }

  return {
    sourceTotal: sourceSkills.length,
    installedTotal: runtimeOwned.length,
    notInstalled: sorted(
      sourceSkills.map((skill) => skill.slug).filter((name) => !runtimeMap.has(name)),
    ),
    installedOnly: sorted(
      runtimeOwned.map((skill) => skill.slug).filter((name) => !sourceMap.has(name)),
    ),
    runtimeDrift: sorted(runtimeDrift),
  };
}

export async function sourceSkillDir(
  source: SourceConfig,
  skill: string,
): Promise<string | undefined> {
  const skills = await scanSkillRepo(source.path);
  const found = skills.find((entry) => entry.slug === skill || entry.name === skill);
  return found?.dir ?? join(source.path, skill);
}
