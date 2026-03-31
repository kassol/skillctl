import { lstat, mkdir, mkdtemp, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { disableSkill, enableSkill, isManaged, removeSkill } from "../src/services/linker";

describe("linker", () => {
  let tempDir: string;
  let canonicalRoot: string;
  let agentSkillsDir: string;
  let skillDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "linker-test-"));
    canonicalRoot = join(tempDir, ".agents", "skills");
    agentSkillsDir = join(tempDir, ".claude", "skills");
    skillDir = join(canonicalRoot, "test-skill");
    await mkdir(skillDir, { recursive: true });
    await mkdir(agentSkillsDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), "---\nname: test-skill\ndescription: test\n---\n");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("creates symlink to enable a skill", async () => {
    const linkPath = join(agentSkillsDir, "test-skill");
    await enableSkill(skillDir, linkPath);
    const stat = await lstat(linkPath);
    expect(stat.isSymbolicLink()).toBe(true);
    const target = await readlink(linkPath);
    expect(target).toBe(skillDir);
  });

  it("removes symlink to disable a skill", async () => {
    const linkPath = join(agentSkillsDir, "test-skill");
    await symlink(skillDir, linkPath);
    await disableSkill(linkPath, canonicalRoot);
    await expect(lstat(linkPath)).rejects.toThrow();
  });

  it("refuses to disable non-managed symlink", async () => {
    const outsideDir = join(tempDir, "outside", "skill");
    await mkdir(outsideDir, { recursive: true });
    const linkPath = join(agentSkillsDir, "rogue-skill");
    await symlink(outsideDir, linkPath);
    await expect(disableSkill(linkPath, canonicalRoot)).rejects.toThrow(/not managed/);
  });

  it("isManaged returns true for canonical root paths", async () => {
    const linkPath = join(agentSkillsDir, "test-skill");
    await symlink(skillDir, linkPath);
    expect(await isManaged(linkPath, canonicalRoot)).toBe(true);
  });

  it("isManaged returns false for external paths", async () => {
    const outsideDir = join(tempDir, "outside");
    await mkdir(outsideDir, { recursive: true });
    const linkPath = join(agentSkillsDir, "ext-skill");
    await symlink(outsideDir, linkPath);
    expect(await isManaged(linkPath, canonicalRoot)).toBe(false);
  });

  it("disables dangling symlinks pointing into canonical root", async () => {
    const danglingTarget = join(canonicalRoot, "deleted-skill");
    const linkPath = join(agentSkillsDir, "deleted-skill");
    await symlink(danglingTarget, linkPath);
    await disableSkill(linkPath, canonicalRoot);
    await expect(lstat(linkPath)).rejects.toThrow();
  });

  it("removeSkill deletes source and all agent symlinks", async () => {
    const linkPath = join(agentSkillsDir, "test-skill");
    await symlink(skillDir, linkPath);
    await removeSkill(skillDir, [linkPath], canonicalRoot);
    await expect(lstat(linkPath)).rejects.toThrow();
    await expect(lstat(skillDir)).rejects.toThrow();
  });

  it("enableSkill throws if existing symlink points elsewhere", async () => {
    const otherDir = join(tempDir, "other");
    await mkdir(otherDir, { recursive: true });
    const linkPath = join(agentSkillsDir, "test-skill");
    await symlink(otherDir, linkPath);
    await expect(enableSkill(skillDir, linkPath)).rejects.toThrow(/already exists/);
  });
});
