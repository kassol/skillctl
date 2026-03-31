import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { scanInstalledSkills, parseLockFile, resolveAgentBindings } from "../src/services/scanner";
import { mkdtemp, rm, mkdir, writeFile, symlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("scanner", () => {
  let tempDir: string;
  let canonicalRoot: string;
  let claudeSkillsDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "scanner-test-"));
    canonicalRoot = join(tempDir, ".agents", "skills");
    claudeSkillsDir = join(tempDir, ".claude", "skills");
    await mkdir(canonicalRoot, { recursive: true });
    await mkdir(claudeSkillsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("discovers skills in canonical root with SKILL.md", async () => {
    const skillDir = join(canonicalRoot, "test-skill");
    await mkdir(skillDir);
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: test-skill\ndescription: A test\n---\nContent");
    const skills = await scanInstalledSkills(canonicalRoot, {});
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("test-skill");
    expect(skills[0].description).toBe("A test");
  });

  it("marks skill as managed when inside canonical root", async () => {
    const skillDir = join(canonicalRoot, "test-skill");
    await mkdir(skillDir);
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: test-skill\ndescription: A test\n---\n");
    const skills = await scanInstalledSkills(canonicalRoot, {});
    expect(skills[0].managed).toBe(true);
  });

  it("resolves agent bindings from symlinks", async () => {
    const skillDir = join(canonicalRoot, "test-skill");
    await mkdir(skillDir);
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: test-skill\ndescription: A test\n---\n");
    await symlink(skillDir, join(claudeSkillsDir, "test-skill"));
    const agents = [{ name: "claude-code" as const, displayName: "Claude Code", globalSkillsDir: claudeSkillsDir }];
    const bindings = await resolveAgentBindings("test-skill", agents, canonicalRoot);
    expect(bindings).toHaveLength(1);
    expect(bindings[0].linked).toBe(true);
  });
});

describe("parseLockFile", () => {
  it("parses lock file and extracts repo grouping", () => {
    const lockData = {
      version: 3,
      skills: {
        "skill-a": { source: "owner/repo", pluginName: "repo", sourceType: "github", sourceUrl: "", skillFolderHash: "", installedAt: "", updatedAt: "" },
        "skill-b": { source: "owner/repo", pluginName: "repo", sourceType: "github", sourceUrl: "", skillFolderHash: "", installedAt: "", updatedAt: "" },
        "skill-c": { source: "other/repo", pluginName: "other-repo", sourceType: "github", sourceUrl: "", skillFolderHash: "", installedAt: "", updatedAt: "" },
      },
    };
    const groups = parseLockFile(lockData);
    expect(groups.get("owner/repo")).toEqual(["skill-a", "skill-b"]);
    expect(groups.get("other/repo")).toEqual(["skill-c"]);
  });

  it("returns empty map for invalid lock file", () => {
    const groups = parseLockFile(null);
    expect(groups.size).toBe(0);
  });
});
