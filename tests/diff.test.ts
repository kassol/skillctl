import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sourceDefaults } from "../src/services/config";
import { installDiff } from "../src/services/diff";
import type { Config } from "../src/types";

async function writeSkill(root: string, slug: string, body = "body"): Promise<void> {
  const dir = join(root, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${slug}\ndescription: ${slug}\n---\n${body}\n`,
    "utf-8",
  );
}

describe("install diff", () => {
  let tempDir: string;
  let sourcePath: string;
  let globalStore: string;
  let lockFile: string;
  let config: Config;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillctl-diff-test-"));
    sourcePath = join(tempDir, "source");
    globalStore = join(tempDir, "global");
    lockFile = join(tempDir, "lock.json");
    await writeSkill(sourcePath, "alpha", "source body");
    await writeSkill(sourcePath, "beta", "source body");
    await writeSkill(globalStore, "alpha", "runtime body");
    await writeSkill(globalStore, "old", "old body");
    await writeFile(
      lockFile,
      JSON.stringify({
        version: 3,
        skills: {
          alpha: { source: "owner/repo", sourceUrl: "https://github.com/owner/repo.git" },
          old: { source: "owner/repo", sourceUrl: "https://github.com/owner/repo.git" },
        },
      }),
      "utf-8",
    );
    config = {
      version: 1,
      runtime: { globalStore, lockFile, npx: "npx --yes skills" },
      sources: { mine: sourceDefaults({ path: sourcePath, installRef: "owner/repo" }) },
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reports not-installed, installed-only, and runtime drift", async () => {
    const diff = await installDiff(config, config.sources.mine);
    expect(diff.sourceTotal).toBe(2);
    expect(diff.installedTotal).toBe(2);
    expect(diff.notInstalled).toEqual(["beta"]);
    expect(diff.installedOnly).toEqual(["old"]);
    expect(diff.runtimeDrift).toEqual(["alpha"]);
  });
});
