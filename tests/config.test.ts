import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getConfigValue,
  parseConfigValue,
  readConfig,
  setConfigValue,
  sourceDefaults,
  unsetConfigValue,
  writeConfig,
} from "../src/services/config";
import type { Config } from "../src/types";

describe("config", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skillctl-config-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns a user-level default config when file does not exist", async () => {
    const config = await readConfig(join(tempDir, "missing.json"));
    expect(config.version).toBe(1);
    expect(config.runtime.globalStore).toContain(".agents/skills");
    expect(config.runtime.lockFile).toContain(".agents/.skill-lock.json");
    expect(config.runtime.npx).toBe("npx --yes skills");
    expect(config.sources).toEqual({});
  });

  it("normalizes source defaults when reading existing config", async () => {
    const configPath = join(tempDir, "config.json");
    await writeFile(
      configPath,
      JSON.stringify({
        version: 1,
        runtime: { globalStore: "~/.agents/skills" },
        sources: {
          mine: { path: "~/Workspace/my-skills", installRef: "kassol/my-skills" },
        },
      }),
      "utf-8",
    );

    const config = await readConfig(configPath);
    expect(config.sources.mine.defaultAgents).toEqual(["*"]);
    expect(config.sources.mine.publishBranch).toBe("main");
    expect(config.sources.mine.path).toContain("Workspace/my-skills");
  });

  it("writes config atomically and creates parent dirs", async () => {
    const configPath = join(tempDir, "nested", "config.json");
    const config: Config = {
      version: 1,
      runtime: { globalStore: "/tmp/global", lockFile: "/tmp/lock.json", npx: "npx --yes skills" },
      sources: {
        mine: sourceDefaults({ path: "/tmp/source", installRef: "owner/repo" }),
      },
    };
    await writeConfig(configPath, config);
    const parsed = JSON.parse(await readFile(configPath, "utf-8"));
    expect(parsed.sources.mine.installRef).toBe("owner/repo");
  });

  it("supports dotpath get/set/unset", () => {
    const config: Config = {
      version: 1,
      runtime: { globalStore: "/tmp/global", lockFile: "/tmp/lock.json", npx: "npx --yes skills" },
      sources: { mine: sourceDefaults({ path: "/tmp/source", installRef: "owner/repo" }) },
    };
    const withPath = setConfigValue(config, "sources.mine.path", "/tmp/source-2");
    expect(getConfigValue(withPath, "sources.mine.path")).toBe("/tmp/source-2");
    const removed = unsetConfigValue(withPath, "sources.mine.remote");
    expect(getConfigValue(removed, "sources.mine.path")).toBe("/tmp/source-2");
  });

  it("parses JSON-ish config values", () => {
    expect(parseConfigValue("true")).toBe(true);
    expect(parseConfigValue("42")).toBe(42);
    expect(parseConfigValue('["*"]')).toEqual(["*"]);
    expect(parseConfigValue("plain string")).toBe("plain string");
  });
});
