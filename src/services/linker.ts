import { lstat, mkdir, readlink, realpath, rm, symlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export async function isManaged(linkPath: string, canonicalRoot: string): Promise<boolean> {
  try {
    const [resolved, root] = await Promise.all([realpath(linkPath), realpath(canonicalRoot)]);
    return resolved.startsWith(root);
  } catch {
    return false;
  }
}

export async function enableSkill(canonicalPath: string, linkPath: string): Promise<void> {
  await mkdir(dirname(linkPath), { recursive: true });
  try {
    const stat = await lstat(linkPath);
    if (stat.isSymbolicLink()) {
      const target = await readlink(linkPath);
      const resolved = resolve(dirname(linkPath), target);
      if (resolved === resolve(canonicalPath)) return;
      throw new Error(
        `${linkPath} already exists but points to ${resolved}, expected ${canonicalPath}`,
      );
    }
    throw new Error(`${linkPath} exists and is not a symlink`);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      await symlink(canonicalPath, linkPath);
      return;
    }
    throw err;
  }
}

export async function disableSkill(linkPath: string, canonicalRoot: string): Promise<void> {
  const stat = await lstat(linkPath);
  if (!stat.isSymbolicLink()) {
    throw new Error(`${linkPath} is not a symlink`);
  }
  const target = await readlink(linkPath);
  const resolved = resolve(dirname(linkPath), target);
  const root = resolve(canonicalRoot);
  if (!resolved.startsWith(root)) {
    throw new Error(
      `Symlink at ${linkPath} is not managed (target ${resolved} outside canonical root)`,
    );
  }
  await rm(linkPath);
}

export async function removeSkill(
  canonicalPath: string,
  agentLinkPaths: string[],
  canonicalRoot: string,
): Promise<void> {
  const root = await realpath(canonicalRoot);
  for (const linkPath of agentLinkPaths) {
    try {
      const stat = await lstat(linkPath);
      if (stat.isSymbolicLink()) {
        const target = await readlink(linkPath);
        const rawResolved = resolve(dirname(linkPath), target);
        let resolved: string;
        try {
          resolved = await realpath(rawResolved);
        } catch {
          resolved = rawResolved;
        }
        if (resolved.startsWith(root)) {
          await rm(linkPath);
        }
      }
    } catch {
      /* already gone */
    }
  }
  const resolved = await realpath(canonicalPath);
  if (resolved.startsWith(root)) {
    await rm(canonicalPath, { recursive: true, force: true });
  }
}
