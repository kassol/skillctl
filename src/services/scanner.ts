import { lstat, readdir, readFile, readlink, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import matter from "gray-matter";
import type { AgentBinding, AgentInfo, LocalSkill } from "../types.js";
import { isSubPath } from "./linker.js";

export interface LockFileData {
  version: number;
  skills: Record<string, { source: string; pluginName?: string; [key: string]: unknown }>;
}

export function parseLockFile(data: unknown): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  if (!data || typeof data !== "object") return groups;
  const lock = data as LockFileData;
  if (!lock.skills || typeof lock.skills !== "object") return groups;
  for (const [skillName, entry] of Object.entries(lock.skills)) {
    const source = entry.source;
    if (!source) continue;
    const existing = groups.get(source) ?? [];
    existing.push(skillName);
    groups.set(source, existing);
  }
  return groups;
}

export async function readLockFile(lockPath: string): Promise<LockFileData | null> {
  try {
    const raw = await readFile(lockPath, "utf-8");
    return JSON.parse(raw) as LockFileData;
  } catch {
    return null;
  }
}

export async function resolveAgentBindings(
  skillName: string,
  agents: AgentInfo[],
  canonicalRoot: string,
): Promise<AgentBinding[]> {
  let resolvedRoot: string;
  try {
    resolvedRoot = await realpath(canonicalRoot);
  } catch {
    resolvedRoot = resolve(canonicalRoot);
  }
  const bindings: AgentBinding[] = [];
  for (const agent of agents) {
    if (!agent.globalSkillsDir) continue;
    const linkPath = join(agent.globalSkillsDir, skillName);
    let linked = false;
    try {
      const stat = await lstat(linkPath);
      if (stat.isSymbolicLink()) {
        // Only mark as linked if symlink target is inside canonical root
        try {
          const resolved = await realpath(linkPath);
          linked = isSubPath(resolvedRoot, resolved);
        } catch {
          // Dangling symlink — check raw target path
          const target = await readlink(linkPath);
          const rawResolved = resolve(dirname(linkPath), target);
          linked = isSubPath(resolvedRoot, rawResolved);
        }
      } else if (stat.isDirectory()) {
        const resolved = await realpath(linkPath);
        linked = isSubPath(canonicalRoot, resolved);
      }
    } catch {
      /* not linked */
    }
    bindings.push({ agent: agent.name, linked, linkPath });
  }
  return bindings;
}

async function parseSkillDir(
  dirPath: string,
): Promise<{ name: string; description: string } | null> {
  try {
    const skillMdPath = join(dirPath, "SKILL.md");
    const content = await readFile(skillMdPath, "utf-8");
    const { data } = matter(content);
    if (typeof data.name === "string" && typeof data.description === "string") {
      return { name: data.name, description: data.description };
    }
    return null;
  } catch {
    return null;
  }
}

export async function scanInstalledSkills(
  canonicalRoot: string,
  lockGroups: Record<string, string>,
): Promise<Omit<LocalSkill, "agents">[]> {
  const skills: Omit<LocalSkill, "agents">[] = [];
  try {
    const entries = await readdir(canonicalRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      const dirPath = join(canonicalRoot, entry.name);
      const parsed = await parseSkillDir(dirPath);
      if (!parsed) continue;
      let managed = true;
      try {
        const [resolved, canonicalReal] = await Promise.all([
          realpath(dirPath),
          realpath(canonicalRoot),
        ]);
        managed = isSubPath(canonicalReal, resolved);
      } catch {
        managed = false;
      }
      skills.push({
        name: parsed.name,
        description: parsed.description,
        repo: lockGroups[parsed.name] ?? "unknown",
        canonicalPath: dirPath,
        managed,
      });
    }
  } catch {
    /* canonicalRoot doesn't exist */
  }
  return skills;
}
