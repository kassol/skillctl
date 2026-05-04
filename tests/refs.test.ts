import { describe, expect, it } from "vitest";
import { addSkillArgs } from "../src/services/npxSkills";
import { splitCommandLine } from "../src/services/process";
import {
  lockEntryMatchesRepo,
  lockEntryMatchesSource,
  normalizeRef,
  repoCloneUrl,
  sourceRefCandidates,
} from "../src/services/refs";
import type { SourceConfig } from "../src/types";

describe("refs", () => {
  const source: SourceConfig = {
    path: "/Users/me/Workspace/my-skills",
    remote: "git@github.com:kassol/my-skills.git",
    installRef: "kassol/my-skills",
    defaultAgents: ["*"],
    publishBranch: "main",
    fullDepth: false,
  };

  it("normalizes GitHub shorthand, https, and ssh remotes equivalently", () => {
    expect(normalizeRef("kassol/my-skills")).toBe("kassol/my-skills");
    expect(normalizeRef("https://github.com/kassol/my-skills.git")).toBe("kassol/my-skills");
    expect(normalizeRef("git@github.com:kassol/my-skills.git")).toBe("kassol/my-skills");
  });

  it("matches lock entries to configured source candidates", () => {
    expect(sourceRefCandidates(source).has("kassol/my-skills")).toBe(true);
    expect(
      lockEntryMatchesSource({ sourceUrl: "https://github.com/kassol/my-skills.git" }, source),
    ).toBe(true);
    expect(lockEntryMatchesSource({ source: "/Users/me/Workspace/my-skills" }, source)).toBe(true);
    expect(lockEntryMatchesSource({ source: "other/repo" }, source)).toBe(false);
  });

  it("matches lock entries to repo refs", () => {
    expect(lockEntryMatchesRepo({ source: "Kassol/My-Skills" }, "kassol/my-skills")).toBe(true);
    expect(
      lockEntryMatchesRepo(
        { sourceUrl: "git@github.com:kassol/my-skills.git" },
        "https://github.com/kassol/my-skills.git",
      ),
    ).toBe(true);
  });

  it("builds clone URLs for GitHub shorthand", () => {
    expect(repoCloneUrl("owner/repo")).toBe("https://github.com/owner/repo.git");
  });
});

describe("process and npx skills adapter", () => {
  it("splits quoted command lines", () => {
    expect(splitCommandLine("npx --yes skills")).toEqual(["npx", "--yes", "skills"]);
    expect(splitCommandLine("cmd 'two words' \"three words\"")).toEqual([
      "cmd",
      "two words",
      "three words",
    ]);
  });

  it("builds npx skills add commands with variadic agent flag", () => {
    expect(addSkillArgs("owner/repo", "alpha", ["claude-code", "pi"])).toEqual([
      "add",
      "owner/repo",
      "-g",
      "--skill",
      "alpha",
      "--agent",
      "claude-code",
      "pi",
      "-y",
    ]);
  });
});
