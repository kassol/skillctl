import { lstat, realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  Config,
  ProviderDefinition,
  ProviderEntryStatus,
  ProviderInventorySkill,
  ProviderSkillStatus,
  ProviderStatus,
  RuntimeSkill,
} from "../types.js";
import { listGlobalSkillsJson } from "./npxSkills.js";
import { expandHome, isSubPath } from "./paths.js";
import {
  directoriesEqual,
  listDirectoryEntries,
  readLockFile,
  scanGlobalStore,
  symlinkStatus,
} from "./scanner.js";

const DEDICATED_PROVIDER_DEFS: Array<Omit<ProviderDefinition, "type"> & { dir: string }> = [
  { slug: "claude-code", displayName: "Claude Code", dir: "~/.claude/skills" },
  { slug: "codex", displayName: "Codex", dir: "~/.codex/skills" },
  { slug: "cursor", displayName: "Cursor", dir: "~/.cursor/skills" },
  { slug: "gemini-cli", displayName: "Gemini CLI", dir: "~/.gemini/skills" },
  { slug: "opencode", displayName: "OpenCode", dir: "~/.config/opencode/skills" },
  { slug: "openclaw", displayName: "OpenClaw", dir: "~/.config/openclaw/skills" },
  { slug: "goose", displayName: "Goose", dir: "~/.config/goose/skills" },
  { slug: "roo-code", displayName: "Roo Code", dir: "~/.roo/skills" },
  { slug: "cline", displayName: "Cline", dir: "~/.cline/skills" },
  { slug: "qwen-code", displayName: "Qwen Code", dir: "~/.qwen/skills" },
  { slug: "crush", displayName: "Crush", dir: "~/.config/crush/skills" },
  { slug: "augment", displayName: "Augment", dir: "~/.augment/skills" },
  { slug: "windsurf", displayName: "Windsurf", dir: "~/.codeium/windsurf/skills" },
];

function slugifyProvider(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function knownProviders(config: Config): ProviderDefinition[] {
  const globalStore = config.runtime.globalStore;
  const providers: ProviderDefinition[] = [
    { slug: "pi", displayName: "Pi", type: "native-global", dir: globalStore },
  ];
  for (const provider of DEDICATED_PROVIDER_DEFS) {
    providers.push({ ...provider, type: "dedicated", dir: expandHome(provider.dir) });
  }
  return providers;
}

export function providerBySlugOrName(
  config: Config,
  value: string,
): ProviderDefinition | undefined {
  const normalized = slugifyProvider(value);
  return knownProviders(config).find(
    (provider) =>
      provider.slug === normalized || slugifyProvider(provider.displayName) === normalized,
  );
}

export async function providerInventory(config: Config): Promise<ProviderInventorySkill[]> {
  const raw = await listGlobalSkillsJson(config);
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      name: String(item.name ?? ""),
      path: typeof item.path === "string" ? item.path : undefined,
      scope: typeof item.scope === "string" ? item.scope : undefined,
      agents: Array.isArray(item.agents) ? item.agents.map(String) : [],
    }))
    .filter((item) => item.name);
}

export async function listProviders(
  config: Config,
): Promise<Array<ProviderDefinition & { skills: number }>> {
  const inventory = await providerInventory(config);
  const counts = new Map<string, number>();
  for (const item of inventory) {
    for (const agent of item.agents ?? []) {
      const slug = slugifyProvider(agent);
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }

  const known = knownProviders(config).map((provider) => ({
    ...provider,
    skills: counts.get(slugifyProvider(provider.displayName)) ?? 0,
  }));
  const knownSlugs = new Set(known.map((provider) => slugifyProvider(provider.displayName)));
  for (const [slug, skills] of counts.entries()) {
    if (knownSlugs.has(slug)) continue;
    known.push({ slug, displayName: slug, type: "unknown", skills });
  }
  return known.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

function summarize(statuses: ProviderSkillStatus[]): Record<ProviderEntryStatus, number> {
  const summary = {} as Record<ProviderEntryStatus, number>;
  for (const status of statuses) {
    summary[status.status] = (summary[status.status] ?? 0) + 1;
  }
  return summary;
}

async function classifyProviderEntry(
  providerDir: string,
  globalStore: string,
  skill: string,
): Promise<ProviderSkillStatus> {
  const providerEntry = join(providerDir, skill);
  const globalEntry = join(globalStore, skill);
  const link = await symlinkStatus(providerEntry, globalEntry);
  if (!link.exists) return { skill, status: "GLOBAL_ONLY" };
  if (link.symlink) {
    if (link.broken) return { skill, status: "BROKEN_LINK", detail: link.target };
    if (link.pointsToExpected) return { skill, status: "LINK_OK", detail: link.target };
    return { skill, status: "LINK_WRONG_TARGET", detail: link.target };
  }
  try {
    const stat = await lstat(providerEntry);
    if (stat.isDirectory()) {
      const equal = await directoriesEqual(providerEntry, globalEntry);
      return { skill, status: equal ? "COPY_OK" : "COPY_DRIFT" };
    }
  } catch {
    // fall through
  }
  return { skill, status: "NOT_CHECKABLE", detail: providerEntry };
}

export async function providerStatuses(
  config: Config,
  options: { provider?: string; skills?: string[] } = {},
): Promise<ProviderStatus[]> {
  const lock = await readLockFile(config.runtime.lockFile);
  const globalSkills = await scanGlobalStore(config.runtime.globalStore, lock);
  const hasExplicitSkillFilter = Boolean(options.skills?.length);
  const selectedSkills = new Set(
    options.skills?.length ? options.skills : globalSkills.map((skill) => skill.slug),
  );
  const providers = options.provider
    ? knownProviders(config).filter(
        (provider) =>
          provider.slug === options.provider || provider.displayName === options.provider,
      )
    : knownProviders(config);

  const results: ProviderStatus[] = [];
  for (const provider of providers) {
    const statuses: ProviderSkillStatus[] = [];
    if (provider.type === "native-global") {
      for (const skill of selectedSkills) statuses.push({ skill, status: "SYNCED_BY_DESIGN" });
      results.push({ provider, statuses, summary: summarize(statuses) });
      continue;
    }
    if (!provider.dir) {
      for (const skill of selectedSkills) statuses.push({ skill, status: "NOT_CHECKABLE" });
      results.push({ provider, statuses, summary: summarize(statuses) });
      continue;
    }

    for (const skill of selectedSkills) {
      statuses.push(await classifyProviderEntry(provider.dir, config.runtime.globalStore, skill));
    }

    if (!hasExplicitSkillFilter) {
      const providerEntries = await listDirectoryEntries(provider.dir);
      for (const skill of providerEntries) {
        if (selectedSkills.has(skill)) continue;
        statuses.push({ skill, status: "PROVIDER_ONLY", detail: join(provider.dir, skill) });
      }
    }
    results.push({ provider, statuses, summary: summarize(statuses) });
  }
  return results;
}

export async function providerOutOfSyncBySkill(
  config: Config,
  skills: string[],
): Promise<Record<string, string[]>> {
  const statuses = await providerStatuses(config, { skills });
  const out: Record<string, string[]> = {};
  for (const providerStatus of statuses) {
    const bad = providerStatus.statuses
      .filter((item) => !["SYNCED_BY_DESIGN", "LINK_OK", "COPY_OK"].includes(item.status))
      .map((item) => item.skill);
    if (bad.length) out[providerStatus.provider.slug] = bad;
  }
  return out;
}

export async function removableProviderEntry(
  config: Config,
  provider: ProviderDefinition,
  skill: string,
): Promise<string> {
  if (provider.type === "native-global") {
    throw new Error(
      `${provider.displayName} uses ${config.runtime.globalStore} directly; unlink is not supported.`,
    );
  }
  if (!provider.dir)
    throw new Error(`Provider ${provider.displayName} has no checkable directory.`);
  const entry = join(provider.dir, skill);
  try {
    const stat = await lstat(entry);
    if (stat.isSymbolicLink()) return entry;
    if (stat.isDirectory()) return entry;
  } catch {
    throw new Error(`${entry} does not exist.`);
  }
  throw new Error(`${entry} is not a skill directory or symlink.`);
}

export async function providerEntryPointsToGlobal(
  config: Config,
  provider: ProviderDefinition,
  skill: string,
): Promise<boolean> {
  if (!provider.dir) return false;
  const entry = join(provider.dir, skill);
  try {
    const resolvedEntry = await realpath(entry);
    const resolvedGlobal = await realpath(join(config.runtime.globalStore, skill));
    return resolvedEntry === resolvedGlobal || isSubPath(resolvedGlobal, resolvedEntry);
  } catch {
    return false;
  }
}

export function filterRuntimeSkillsByNames(
  skills: RuntimeSkill[],
  names?: string[],
): RuntimeSkill[] {
  if (!names?.length) return skills;
  const wanted = new Set(names);
  return skills.filter((skill) => wanted.has(skill.slug) || wanted.has(skill.name));
}

export function globalSkillDir(config: Config, skill: string): string {
  return resolve(config.runtime.globalStore, skill);
}
