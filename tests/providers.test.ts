import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { providerStatuses } from "../src/services/providers";
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

describe("providers", () => {
  let tempDir: string;
  let globalStore: string;
  let config: Config;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillctl-provider-test-"));
    globalStore = join(tempDir, "global");
    await writeSkill(globalStore, "alpha");
    config = {
      version: 1,
      runtime: { globalStore, lockFile: join(tempDir, "lock.json"), npx: "npx --yes skills" },
      sources: {},
    };
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("marks Pi as synced by design because it reads the global store directly", async () => {
    const statuses = await providerStatuses(config, { provider: "pi", skills: ["alpha"] });
    expect(statuses[0].provider.type).toBe("native-global");
    expect(statuses[0].statuses[0].status).toBe("SYNCED_BY_DESIGN");
  });
});
