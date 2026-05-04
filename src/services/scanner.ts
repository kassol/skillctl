import { createHash } from "node:crypto";
import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createTwoFilesPatch } from "diff";
import fg from "fast-glob";
import matter from "gray-matter";
import type { LockFileData, RuntimeSkill, SkillManifest } from "../types.js";
import { isSubPath } from "./paths.js";

const SCAN_IGNORES = ["**/.git/**", "**/node_modules/**", "**/.DS_Store", "**/.claude/**"];

export async function parseSkillDir(
  dir: string,
  root = dirname(dir),
): Promise<SkillManifest | null> {
  const skillFile = join(dir, "SKILL.md");
  try {
    const content = await readFile(skillFile, "utf-8");
    const { data } = matter(content);
    const slug = basename(dir);
    const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : slug;
    const description =
      typeof data.description === "string" && data.description.trim()
        ? data.description.trim()
        : "";
    return {
      slug,
      name,
      description,
      dir,
      skillFile,
      relativeDir: relative(root, dir) || ".",
    };
  } catch {
    return null;
  }
}

export async function scanSkillRepo(root: string): Promise<SkillManifest[]> {
  const absoluteRoot = resolve(root);
  const files = await fg("**/SKILL.md", {
    cwd: absoluteRoot,
    absolute: false,
    onlyFiles: true,
    dot: false,
    ignore: SCAN_IGNORES,
  });
  const manifests = await Promise.all(
    files.sort().map((file) => parseSkillDir(join(absoluteRoot, dirname(file)), absoluteRoot)),
  );
  return manifests.filter((manifest): manifest is SkillManifest => Boolean(manifest));
}

export async function scanGlobalStore(
  globalStore: string,
  lock?: LockFileData | null,
): Promise<RuntimeSkill[]> {
  const skills: RuntimeSkill[] = [];
  try {
    const entries = await readdir(globalStore, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const dir = join(globalStore, entry.name);
      const manifest = await parseSkillDir(dir, globalStore);
      if (!manifest) continue;
      const lockEntry = lock?.skills?.[entry.name] ?? lock?.skills?.[manifest.name];
      skills.push({ ...manifest, lock: lockEntry, source: lockEntry?.source });
    }
  } catch {
    // Missing global store is a valid empty state.
  }
  return skills;
}

export async function readLockFile(lockPath: string): Promise<LockFileData | null> {
  try {
    const raw = await readFile(lockPath, "utf-8");
    return JSON.parse(raw) as LockFileData;
  } catch {
    return null;
  }
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
  for (const skills of groups.values()) skills.sort((a, b) => a.localeCompare(b));
  return groups;
}

export async function listDirectoryEntries(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => !entry.name.startsWith("."))
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function hashDirectory(dir: string): Promise<string | null> {
  try {
    const stat = await lstat(dir);
    if (!stat.isDirectory() && !stat.isSymbolicLink()) return null;
  } catch {
    return null;
  }

  const files = await fg("**/*", {
    cwd: dir,
    onlyFiles: true,
    absolute: false,
    dot: true,
    ignore: SCAN_IGNORES,
  });
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(join(dir, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

export async function directoriesEqual(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([hashDirectory(a), hashDirectory(b)]);
  return Boolean(hashA && hashB && hashA === hashB);
}

async function readTextFiles(dir: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const files = await fg("**/*", {
      cwd: dir,
      onlyFiles: true,
      absolute: false,
      dot: true,
      ignore: SCAN_IGNORES,
    });
    for (const file of files.sort()) {
      try {
        const content = await readFile(join(dir, file), "utf-8");
        map.set(file, content);
      } catch {
        map.set(file, "<binary file>\n");
      }
    }
  } catch {
    // Treat missing dir as empty for diffs.
  }
  return map;
}

export async function diffDirectories(
  oldDir: string,
  newDir: string,
  oldLabel = oldDir,
  newLabel = newDir,
): Promise<string> {
  const [oldFiles, newFiles] = await Promise.all([readTextFiles(oldDir), readTextFiles(newDir)]);
  const allFiles = Array.from(new Set([...oldFiles.keys(), ...newFiles.keys()])).sort();
  const patches: string[] = [];
  for (const file of allFiles) {
    const oldText = oldFiles.get(file) ?? "";
    const newText = newFiles.get(file) ?? "";
    if (oldText === newText) continue;
    patches.push(
      createTwoFilesPatch(`${oldLabel}/${file}`, `${newLabel}/${file}`, oldText, newText),
    );
  }
  return patches.join("\n");
}

export async function copySkillDir(from: string, to: string): Promise<void> {
  await mkdir(dirname(to), { recursive: true });
  await rm(to, { recursive: true, force: true });
  await cp(from, to, { recursive: true, force: true, dereference: false });
}

export async function removeEntry(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function writeTextFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf-8");
}

export async function symlinkStatus(
  entryPath: string,
  expectedTarget: string,
): Promise<{
  exists: boolean;
  symlink: boolean;
  broken: boolean;
  target?: string;
  pointsToExpected: boolean;
}> {
  try {
    const stat = await lstat(entryPath);
    if (!stat.isSymbolicLink()) {
      return { exists: true, symlink: false, broken: false, pointsToExpected: false };
    }
    const rawTarget = await readlink(entryPath);
    const targetPath = resolve(dirname(entryPath), rawTarget);
    try {
      const [realTarget, realExpected] = await Promise.all([
        realpath(entryPath),
        realpath(expectedTarget),
      ]);
      return {
        exists: true,
        symlink: true,
        broken: false,
        target: realTarget,
        pointsToExpected: realTarget === realExpected || isSubPath(realExpected, realTarget),
      };
    } catch {
      return {
        exists: true,
        symlink: true,
        broken: true,
        target: targetPath,
        pointsToExpected: resolve(expectedTarget) === targetPath,
      };
    }
  } catch {
    return { exists: false, symlink: false, broken: false, pointsToExpected: false };
  }
}
