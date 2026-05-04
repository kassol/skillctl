import { runCommand } from "./process.js";

export async function gitStatus(
  path: string,
): Promise<{ ok: boolean; branch?: string; dirty?: boolean; output: string }> {
  const branch = await runCommand(["git", "-C", path, "rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch.code !== 0) return { ok: false, output: branch.stderr || branch.stdout };
  const status = await runCommand(["git", "-C", path, "status", "--short"]);
  return {
    ok: status.code === 0,
    branch: branch.stdout.trim(),
    dirty: Boolean(status.stdout.trim()),
    output: status.stdout.trim(),
  };
}

export async function gitPush(path: string, branch: string): Promise<void> {
  const result = await runCommand(["git", "-C", path, "push", "origin", branch], {
    passthrough: true,
  });
  if (result.code !== 0) throw new Error(`git push failed with exit code ${result.code}`);
}
