import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  copySkillDir,
  diffDirectories,
  directoriesEqual,
  hashDirectory,
  parseLockFile,
  readLockFile,
  scanGlobalStore,
  scanSkillRepo,
} from "../src/services/scanner";

async function writeSkill(
  root: string,
  slug: string,
  description = "desc",
  extra = "body",
): Promise<void> {
  const dir = join(root, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${slug}\ndescription: ${description}\n---\n${extra}\n`,
    "utf-8",
  );
}

describe("scanner", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillctl-scanner-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("discovers skills in nested repos by SKILL.md", async () => {
    await writeSkill(join(tempDir, "skills"), "alpha", "Alpha skill");
    await writeSkill(tempDir, "beta", "Beta skill");

    const skills = await scanSkillRepo(tempDir);
    expect(skills.map((skill) => skill.slug).sort()).toEqual(["alpha", "beta"]);
    expect(skills.find((skill) => skill.slug === "alpha")?.relativeDir).toBe("skills/alpha");
  });

  it("scans global store and attaches lock entries", async () => {
    const global = join(tempDir, "global");
    const lockPath = join(tempDir, "lock.json");
    await writeSkill(global, "alpha");
    await writeFile(
      lockPath,
      JSON.stringify({
        version: 3,
        skills: { alpha: { source: "owner/repo", sourceUrl: "https://github.com/owner/repo.git" } },
      }),
    );

    const lock = await readLockFile(lockPath);
    const skills = await scanGlobalStore(global, lock);
    expect(skills).toHaveLength(1);
    expect(skills[0].lock?.source).toBe("owner/repo");
  });

  it("groups lockfile entries by source", () => {
    const groups = parseLockFile({
      skills: {
        b: { source: "owner/repo" },
        a: { source: "owner/repo" },
        c: { source: "other/repo" },
      },
    });
    expect(groups.get("owner/repo")).toEqual(["a", "b"]);
    expect(groups.get("other/repo")).toEqual(["c"]);
  });

  it("hashes, diffs, and copies skill directories", async () => {
    const a = join(tempDir, "a");
    const b = join(tempDir, "b");
    await writeSkill(a, "alpha", "desc", "one");
    await writeSkill(b, "alpha", "desc", "two");

    expect(await hashDirectory(join(a, "alpha"))).toBeTruthy();
    expect(await directoriesEqual(join(a, "alpha"), join(b, "alpha"))).toBe(false);
    const patch = await diffDirectories(join(a, "alpha"), join(b, "alpha"), "a", "b");
    expect(patch).toContain("two");

    await copySkillDir(join(b, "alpha"), join(a, "alpha"));
    expect(await directoriesEqual(join(a, "alpha"), join(b, "alpha"))).toBe(true);
    expect(await readFile(join(a, "alpha", "SKILL.md"), "utf-8")).toContain("two");
  });
});
