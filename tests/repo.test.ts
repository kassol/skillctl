import { describe, expect, it } from "vitest";
import { buildAddCommand, buildRemoveCommand, buildSyncCommand } from "../src/services/repo";

describe("repo command builders", () => {
  it("builds add command with agents and global flag", () => {
    const cmd = buildAddCommand("owner/repo", ["claude-code", "codex"]);
    expect(cmd).toEqual([
      "npx",
      "skills",
      "add",
      "owner/repo",
      "-g",
      "-a",
      "claude-code",
      "-a",
      "codex",
      "-y",
    ]);
  });

  it("builds add command with specific skill", () => {
    const cmd = buildAddCommand("owner/repo", ["claude-code"], "my-skill");
    expect(cmd).toEqual([
      "npx",
      "skills",
      "add",
      "owner/repo",
      "-g",
      "-a",
      "claude-code",
      "-y",
      "--skill",
      "my-skill",
    ]);
  });

  it("builds sync command", () => {
    expect(buildSyncCommand()).toEqual(["npx", "skills", "update"]);
  });

  it("builds remove command", () => {
    const cmd = buildRemoveCommand("my-skill", ["claude-code"]);
    expect(cmd).toEqual(["npx", "skills", "remove", "my-skill", "-g", "-a", "claude-code", "-y"]);
  });
});
