import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readConfig, writeConfig } from "../src/services/config";
import type { Config } from "../src/types";

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skills-tui-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns default config when file does not exist", async () => {
    const config = await readConfig(join(tempDir, "config.json"));
    expect(config.defaultAgents).toEqual(["claude-code"]);
    expect(config.repos).toEqual([]);
  });

  it("reads existing config", async () => {
    const configPath = join(tempDir, "config.json");
    const data: Config = {
      defaultAgents: ["claude-code", "codex"],
      repos: [{ source: "owner/repo", addedAt: "2026-04-01" }],
    };
    await writeFile(configPath, JSON.stringify(data), "utf-8");

    const config = await readConfig(configPath);
    expect(config.defaultAgents).toEqual(["claude-code", "codex"]);
    expect(config.repos).toHaveLength(1);
  });

  it("writes config and creates parent dirs", async () => {
    const configPath = join(tempDir, "nested", "dir", "config.json");
    const data: Config = {
      defaultAgents: ["claude-code"],
      repos: [{ source: "owner/repo", addedAt: "2026-04-01" }],
    };
    await writeConfig(configPath, data);

    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.repos).toHaveLength(1);
  });
});
