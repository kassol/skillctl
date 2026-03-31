import { describe, expect, it } from "vitest";
import type { LocalSkill } from "../src/types";
import { isEnabled } from "../src/types";

describe("isEnabled", () => {
  it("returns true when any agent is linked", () => {
    const skill: LocalSkill = {
      name: "test-skill",
      description: "A test skill",
      repo: "owner/repo",
      canonicalPath: "/home/user/.agents/skills/test-skill",
      managed: true,
      agents: [
        { agent: "claude-code", linked: true, linkPath: "/home/user/.claude/skills/test-skill" },
        { agent: "codex", linked: false, linkPath: "/home/user/.codex/skills/test-skill" },
      ],
    };
    expect(isEnabled(skill)).toBe(true);
  });

  it("returns false when no agent is linked", () => {
    const skill: LocalSkill = {
      name: "test-skill",
      description: "A test skill",
      repo: "owner/repo",
      canonicalPath: "/home/user/.agents/skills/test-skill",
      managed: true,
      agents: [
        { agent: "claude-code", linked: false, linkPath: "/home/user/.claude/skills/test-skill" },
      ],
    };
    expect(isEnabled(skill)).toBe(false);
  });

  it("returns false when agents array is empty", () => {
    const skill: LocalSkill = {
      name: "test-skill",
      description: "A test skill",
      repo: "owner/repo",
      canonicalPath: "/home/user/.agents/skills/test-skill",
      managed: true,
      agents: [],
    };
    expect(isEnabled(skill)).toBe(false);
  });
});
