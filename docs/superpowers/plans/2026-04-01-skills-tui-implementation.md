# skills-tui Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-column Miller Columns TUI for managing global agent skills, with marketplace browsing, multi-agent orchestration, and Homebrew distribution.

**Architecture:** TypeScript + ink (React for CLI) with zustand state management. Services layer handles filesystem scanning, symlink operations, skills.sh API, and subprocess calls to `npx skills` for heavy operations (add/sync/remove). Compiled to single binary via `bun build --compile`.

**Tech Stack:** Bun, ink, zustand, gray-matter, vitest, Biome, GitHub Actions

**Key discovery:** The `skills` npm package is a pure CLI with no library exports. We self-implement lightweight operations (scan, symlink, lock file parse, API search) and shell out to `npx skills add/sync/remove` for repo-level operations.

---

## Chunk 1: Project Scaffold + Types + Config

### Task 1: Initialize project and install dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Initialize bun project**

```bash
cd /Users/kassol/Workspace/skills-tui
bun init -y
```

- [ ] **Step 2: Install dependencies**

```bash
bun add ink react gray-matter zustand ink-text-input
bun add -d @types/react vitest @inkjs/testing-library typescript @biomejs/biome
```

- [ ] **Step 3: Configure tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "types": ["bun-types"]
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Configure biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
```

- [ ] **Step 5: Update package.json scripts**

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "bun run src/app.tsx",
    "build": "bun build --compile src/app.tsx --outfile skills-tui",
    "test": "vitest",
    "lint": "biome check src tests",
    "lint:fix": "biome check --write src tests",
    "type-check": "tsc --noEmit"
  }
}
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
skills-tui
*.tsbuildinfo
```

- [ ] **Step 7: Create LICENSE (MIT)**

Standard MIT license with `kassol` as copyright holder.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json biome.json .gitignore LICENSE bun.lockb
git commit -m "chore: initialize project with bun, ink, and tooling"
```

---

### Task 2: Define core types

**Files:**
- Create: `src/types.ts`
- Test: `tests/types.test.ts`

- [ ] **Step 1: Write type validation test**

```typescript
// tests/types.test.ts
import { describe, it, expect } from "vitest";
import type { Repo, LocalSkill, AgentBinding, AgentType, Config } from "../src/types";

describe("types", () => {
  it("LocalSkill enabled is true when any agent is linked", () => {
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

  it("LocalSkill enabled is false when no agent is linked", () => {
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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/types.test.ts
```
Expected: FAIL — `isEnabled` not defined.

- [ ] **Step 3: Write types and helper**

```typescript
// src/types.ts
export type AgentType =
  | "claude-code"
  | "codex"
  | "cursor"
  | "gemini-cli"
  | "opencode"
  | "windsurf"
  | "amp"
  | "goose"
  | "roo"
  | "cline";
// Extensible at runtime from agent config scan

export interface AgentInfo {
  name: AgentType;
  displayName: string;
  globalSkillsDir: string | undefined;
}

export interface AgentBinding {
  agent: AgentType;
  linked: boolean;
  linkPath: string;
}

export interface LocalSkill {
  name: string;
  description: string;
  repo: string;
  canonicalPath: string;
  agents: AgentBinding[];
  managed: boolean;
}

export function isEnabled(skill: LocalSkill): boolean {
  return skill.agents.some((a) => a.linked);
}

export interface Repo {
  source: string;
  url: string;
  skills: LocalSkill[];
  skillCount: number;
  lastSynced?: Date;
}

export interface MarketSkill {
  id: string;
  skillId: string;
  name: string;
  source: string;
  installs: number;
}

export interface Config {
  defaultAgents: AgentType[];
  repos: Array<{ source: string; addedAt: string }>;
}

export const DEFAULT_CONFIG: Config = {
  defaultAgents: ["claude-code"],
  repos: [],
};

export const CANONICAL_ROOT = `${process.env.HOME}/.agents/skills`;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test -- tests/types.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types.ts tests/types.test.ts
git commit -m "feat: define core types (Repo, LocalSkill, AgentBinding, Config)"
```

---

### Task 3: Config service

**Files:**
- Create: `src/services/config.ts`
- Test: `tests/config.test.ts`

- [ ] **Step 1: Write config read/write tests**

```typescript
// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readConfig, writeConfig } from "../src/services/config";
import { mkdtemp, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
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
    await Bun.write(configPath, JSON.stringify(data));

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test -- tests/config.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement config service**

```typescript
// src/services/config.ts
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
import type { Config } from "../types";
import { DEFAULT_CONFIG } from "../types";

const CONFIG_DIR = join(homedir(), ".config", "skills-tui");
const CONFIG_FILE = "config.json";

export function getConfigPath(override?: string): string {
  return override ?? join(CONFIG_DIR, CONFIG_FILE);
}

export async function readConfig(path?: string): Promise<Config> {
  const configPath = getConfigPath(path);
  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return {
      defaultAgents: parsed.defaultAgents ?? DEFAULT_CONFIG.defaultAgents,
      repos: parsed.repos ?? DEFAULT_CONFIG.repos,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeConfig(path: string, config: Config): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
}

export async function addRepo(source: string, path?: string): Promise<void> {
  const configPath = getConfigPath(path);
  const config = await readConfig(configPath);
  if (!config.repos.some((r) => r.source === source)) {
    config.repos.push({ source, addedAt: new Date().toISOString().slice(0, 10) });
    await writeConfig(configPath, config);
  }
}

export async function removeRepo(source: string, path?: string): Promise<void> {
  const configPath = getConfigPath(path);
  const config = await readConfig(configPath);
  config.repos = config.repos.filter((r) => r.source !== source);
  await writeConfig(configPath, config);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test -- tests/config.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/config.ts tests/config.test.ts
git commit -m "feat: add config service (read/write ~/.config/skills-tui/)"
```

---

## Chunk 2: Scanner + Linker Services

### Task 4: Scanner service — scan installed skills

**Files:**
- Create: `src/services/scanner.ts`
- Test: `tests/scanner.test.ts`

- [ ] **Step 1: Write scanner tests**

```typescript
// tests/scanner.test.ts
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
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: test-skill\ndescription: A test\n---\nContent"
    );

    const skills = await scanInstalledSkills(canonicalRoot, {});
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("test-skill");
    expect(skills[0].description).toBe("A test");
  });

  it("marks skill as managed when inside canonical root", async () => {
    const skillDir = join(canonicalRoot, "test-skill");
    await mkdir(skillDir);
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: test-skill\ndescription: A test\n---\n"
    );

    const skills = await scanInstalledSkills(canonicalRoot, {});
    expect(skills[0].managed).toBe(true);
  });

  it("resolves agent bindings from symlinks", async () => {
    const skillDir = join(canonicalRoot, "test-skill");
    await mkdir(skillDir);
    await writeFile(
      join(skillDir, "SKILL.md"),
      "---\nname: test-skill\ndescription: A test\n---\n"
    );
    await symlink(skillDir, join(claudeSkillsDir, "test-skill"));

    const agents = [{ name: "claude-code" as const, displayName: "Claude Code", globalSkillsDir: claudeSkillsDir }];
    const bindings = await resolveAgentBindings("test-skill", agents, canonicalRoot);
    expect(bindings).toHaveLength(1);
    expect(bindings[0].linked).toBe(true);
  });

  it("detects dangling symlinks", async () => {
    // Create symlink to nonexistent target
    await symlink(join(canonicalRoot, "ghost"), join(claudeSkillsDir, "ghost"));

    const agents = [{ name: "claude-code" as const, displayName: "Claude Code", globalSkillsDir: claudeSkillsDir }];
    const bindings = await resolveAgentBindings("ghost", agents, canonicalRoot);
    expect(bindings[0].linked).toBe(true); // symlink exists
    // But canonicalPath won't resolve — scanner marks as unmanaged
  });
});

describe("parseLockFile", () => {
  it("parses lock file and extracts repo grouping", async () => {
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/scanner.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement scanner service**

```typescript
// src/services/scanner.ts
import { readdir, readFile, lstat, realpath, readlink } from "fs/promises";
import { join, resolve } from "path";
import matter from "gray-matter";
import type { LocalSkill, AgentBinding, AgentInfo } from "../types";

export interface LockFileData {
  version: number;
  skills: Record<string, { source: string; pluginName?: string; [key: string]: unknown }>;
}

export function parseLockFile(data: unknown): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  if (!data || typeof data !== "object") return groups;

  const lock = data as LockFileData;
  if (!lock.skills || typeof lock.skills !== "object") return groups;

  for (const [skillName, entry] of Object.entries(lock.skills)) {
    const source = entry.source;
    if (!source) continue;
    const existing = groups.get(source) ?? [];
    existing.push(skillName);
    groups.set(source, existing);
  }
  return groups;
}

export async function readLockFile(lockPath: string): Promise<LockFileData | null> {
  try {
    const raw = await readFile(lockPath, "utf-8");
    return JSON.parse(raw) as LockFileData;
  } catch {
    return null;
  }
}

export async function resolveAgentBindings(
  skillName: string,
  agents: AgentInfo[],
  canonicalRoot: string
): Promise<AgentBinding[]> {
  const bindings: AgentBinding[] = [];

  for (const agent of agents) {
    if (!agent.globalSkillsDir) continue;
    const linkPath = join(agent.globalSkillsDir, skillName);
    let linked = false;

    try {
      const stat = await lstat(linkPath);
      if (stat.isSymbolicLink()) {
        linked = true;
      } else if (stat.isDirectory()) {
        // Direct directory (copy install), check if inside canonical root
        const resolved = await realpath(linkPath);
        linked = resolved.startsWith(canonicalRoot);
      }
    } catch {
      // Path doesn't exist — not linked
    }

    bindings.push({ agent: agent.name, linked, linkPath });
  }

  return bindings;
}

async function parseSkillDir(dirPath: string): Promise<{ name: string; description: string } | null> {
  try {
    const skillMdPath = join(dirPath, "SKILL.md");
    const content = await readFile(skillMdPath, "utf-8");
    const { data } = matter(content);
    if (typeof data.name === "string" && typeof data.description === "string") {
      return { name: data.name, description: data.description };
    }
    return null;
  } catch {
    return null;
  }
}

export async function scanInstalledSkills(
  canonicalRoot: string,
  lockGroups: Record<string, string> // skillName → source
): Promise<Omit<LocalSkill, "agents">[]> {
  const skills: Omit<LocalSkill, "agents">[] = [];

  try {
    const entries = await readdir(canonicalRoot, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;

      const dirPath = join(canonicalRoot, entry.name);
      const parsed = await parseSkillDir(dirPath);
      if (!parsed) continue;

      // Check managed status
      let managed = true;
      try {
        const resolved = await realpath(dirPath);
        managed = resolved.startsWith(resolve(canonicalRoot));
      } catch {
        managed = false;
      }

      skills.push({
        name: parsed.name,
        description: parsed.description,
        repo: lockGroups[parsed.name] ?? "unknown",
        canonicalPath: dirPath,
        managed,
      });
    }
  } catch {
    // canonicalRoot doesn't exist
  }

  return skills;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/scanner.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/scanner.ts tests/scanner.test.ts
git commit -m "feat: add scanner service (skill discovery, lock file parsing, agent bindings)"
```

---

### Task 5: Linker service — symlink operations with ownership verification

**Files:**
- Create: `src/services/linker.ts`
- Test: `tests/linker.test.ts`

- [ ] **Step 1: Write linker tests**

```typescript
// tests/linker.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { enableSkill, disableSkill, isManaged } from "../src/services/linker";
import { mkdtemp, rm, mkdir, writeFile, symlink, lstat, readlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

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
    // Create symlink to path that will be inside canonical root but doesn't exist
    const danglingTarget = join(canonicalRoot, "deleted-skill");
    const linkPath = join(agentSkillsDir, "deleted-skill");
    await symlink(danglingTarget, linkPath);

    // Should succeed because readlink shows target is inside canonical root
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/linker.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement linker service**

```typescript
// src/services/linker.ts
import { symlink, rm, lstat, realpath, mkdir, readlink } from "fs/promises";
import { dirname, resolve } from "path";

export async function isManaged(linkPath: string, canonicalRoot: string): Promise<boolean> {
  try {
    const resolved = await realpath(linkPath);
    return resolved.startsWith(resolve(canonicalRoot));
  } catch {
    return false;
  }
}

export async function enableSkill(canonicalPath: string, linkPath: string): Promise<void> {
  await mkdir(dirname(linkPath), { recursive: true });
  try {
    const stat = await lstat(linkPath);
    if (stat.isSymbolicLink()) {
      // Check if existing symlink points to the right target
      const target = await readlink(linkPath);
      const resolved = resolve(dirname(linkPath), target);
      if (resolved === resolve(canonicalPath)) return; // Already correct
      throw new Error(`${linkPath} already exists but points to ${resolved}, expected ${canonicalPath}`);
    }
    throw new Error(`${linkPath} exists and is not a symlink`);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      // Doesn't exist — create
      await symlink(canonicalPath, linkPath);
      return;
    }
    throw err;
  }
}

export async function disableSkill(linkPath: string, canonicalRoot: string): Promise<void> {
  const stat = await lstat(linkPath);
  if (!stat.isSymbolicLink()) {
    throw new Error(`${linkPath} is not a symlink`);
  }

  // For dangling symlinks, readlink still works (reads the link, not the target)
  const target = await readlink(linkPath);
  const resolved = resolve(dirname(linkPath), target);
  if (!resolved.startsWith(resolve(canonicalRoot))) {
    throw new Error(`Symlink at ${linkPath} is not managed (target ${resolved} outside canonical root)`);
  }

  await rm(linkPath);
}

export async function removeSkill(
  canonicalPath: string,
  agentLinkPaths: string[],
  canonicalRoot: string
): Promise<void> {
  // Remove all agent symlinks first
  for (const linkPath of agentLinkPaths) {
    try {
      const managed = await isManaged(linkPath, canonicalRoot);
      if (managed) {
        await rm(linkPath);
      }
    } catch {
      // Already gone
    }
  }

  // Remove canonical source
  const resolved = await realpath(canonicalPath);
  if (resolved.startsWith(resolve(canonicalRoot))) {
    await rm(canonicalPath, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/linker.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/linker.ts tests/linker.test.ts
git commit -m "feat: add linker service (enable/disable/remove with ownership verification)"
```

---

## Chunk 3: Market + Repo Services

### Task 6: Market service — skills.sh API client

**Files:**
- Create: `src/services/market.ts`
- Test: `tests/market.test.ts`

- [ ] **Step 1: Write market service tests**

```typescript
// tests/market.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchMarket, type MarketSearchResult } from "../src/services/market";

describe("market", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed skills from API response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          { id: "owner/repo/skill-a", skillId: "skill-a", name: "Skill A", source: "owner/repo", installs: 1000 },
        ],
        count: 1,
      }),
    });

    const results = await searchMarket("skill");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Skill A");
    expect(results[0].installs).toBe(1000);
  });

  it("returns empty array on API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

    const results = await searchMarket("skill");
    expect(results).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));

    const results = await searchMarket("skill");
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/market.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement market service**

```typescript
// src/services/market.ts
import type { MarketSkill } from "../types";

const API_BASE = "https://skills.sh";

export type MarketSearchResult = MarketSkill;

export async function searchMarket(query: string, limit = 20): Promise<MarketSearchResult[]> {
  try {
    const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = (await res.json()) as {
      skills: Array<{ id: string; skillId: string; name: string; source: string; installs: number }>;
    };

    return data.skills.map((s) => ({
      id: s.id,
      skillId: s.skillId,
      name: s.name,
      source: s.source,
      installs: s.installs,
    }));
  } catch {
    return [];
  }
}

export function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/market.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/market.ts tests/market.test.ts
git commit -m "feat: add market service (skills.sh API search)"
```

---

### Task 7: Repo service — subprocess operations

**Files:**
- Create: `src/services/repo.ts`
- Test: `tests/repo.test.ts`

- [ ] **Step 1: Write repo service tests**

```typescript
// tests/repo.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildAddCommand, buildSyncCommand, buildRemoveCommand } from "../src/services/repo";

describe("repo command builders", () => {
  it("builds add command with agents and global flag", () => {
    const cmd = buildAddCommand("owner/repo", ["claude-code", "codex"]);
    expect(cmd).toEqual([
      "npx", "skills", "add", "owner/repo",
      "-g", "-a", "claude-code", "-a", "codex", "-y",
    ]);
  });

  it("builds add command with specific skill", () => {
    const cmd = buildAddCommand("owner/repo", ["claude-code"], "my-skill");
    expect(cmd).toEqual([
      "npx", "skills", "add", "owner/repo",
      "-g", "-a", "claude-code", "-y", "--skill", "my-skill",
    ]);
  });

  it("builds sync command", () => {
    const cmd = buildSyncCommand();
    expect(cmd).toEqual(["npx", "skills", "update"]);
  });

  it("builds remove command", () => {
    const cmd = buildRemoveCommand("my-skill", ["claude-code"]);
    expect(cmd).toEqual([
      "npx", "skills", "remove", "my-skill",
      "-g", "-a", "claude-code", "-y",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/repo.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement repo service**

```typescript
// src/services/repo.ts
import { spawn } from "child_process";
import type { AgentType } from "../types";

export function buildAddCommand(
  source: string,
  agents: AgentType[],
  skill?: string
): string[] {
  const cmd = ["npx", "skills", "add", source, "-g"];
  for (const agent of agents) {
    cmd.push("-a", agent);
  }
  cmd.push("-y");
  if (skill) {
    cmd.push("--skill", skill);
  }
  return cmd;
}

export function buildSyncCommand(): string[] {
  return ["npx", "skills", "update"];
}

export function buildRemoveCommand(skillName: string, agents: AgentType[]): string[] {
  const cmd = ["npx", "skills", "remove", skillName, "-g"];
  for (const agent of agents) {
    cmd.push("-a", agent);
  }
  cmd.push("-y");
  return cmd;
}

export async function execCommand(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(args[0], args.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => { stdout += data; });
    proc.stderr.on("data", (data) => { stderr += data; });

    proc.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export async function addRepo(source: string, agents: AgentType[], skill?: string): Promise<void> {
  const cmd = buildAddCommand(source, agents, skill);
  const result = await execCommand(cmd);
  if (result.code !== 0) {
    throw new Error(`Failed to add ${source}: ${result.stderr}`);
  }
}

export async function syncRepos(): Promise<void> {
  const cmd = buildSyncCommand();
  const result = await execCommand(cmd);
  if (result.code !== 0) {
    throw new Error(`Failed to sync: ${result.stderr}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/repo.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/repo.ts tests/repo.test.ts
git commit -m "feat: add repo service (npx skills subprocess wrapper)"
```

---

## Chunk 4: State Store + App Shell

### Task 8: Zustand store

**Files:**
- Create: `src/hooks/useSkills.ts`
- Test: `tests/useSkills.test.ts`

- [ ] **Step 1: Write store tests**

```typescript
// tests/useSkills.test.ts
import { describe, it, expect } from "vitest";
import { createSkillsStore, type SkillsState } from "../src/hooks/useSkills";
import type { LocalSkill, Repo } from "../src/types";

describe("skills store", () => {
  it("initializes with empty state", () => {
    const store = createSkillsStore();
    const state = store.getState();
    expect(state.repos).toEqual([]);
    expect(state.focusedColumn).toBe(0);
    expect(state.loading).toBe(true);
  });

  it("setRepos updates repos", () => {
    const store = createSkillsStore();
    const repos: Repo[] = [
      { source: "owner/repo", url: "", skills: [], skillCount: 0 },
    ];
    store.getState().setRepos(repos);
    expect(store.getState().repos).toEqual(repos);
  });

  it("selectRepo updates selectedRepo index", () => {
    const store = createSkillsStore();
    store.getState().selectRepo(2);
    expect(store.getState().selectedRepo).toBe(2);
    expect(store.getState().selectedSkill).toBe(0); // reset
  });

  it("navigates focus columns with wrap", () => {
    const store = createSkillsStore();
    store.getState().focusNext();
    expect(store.getState().focusedColumn).toBe(1);
    store.getState().focusNext();
    expect(store.getState().focusedColumn).toBe(2);
    store.getState().focusNext();
    expect(store.getState().focusedColumn).toBe(0); // wrap
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test -- tests/useSkills.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement store**

```typescript
// src/hooks/useSkills.ts
import { createStore } from "zustand/vanilla";
import type { Repo, LocalSkill, MarketSkill, Config } from "../types";

export interface SkillsState {
  // Data
  repos: Repo[];
  marketResults: MarketSkill[];
  config: Config | null;

  // Selection
  selectedRepo: number;
  selectedSkill: number;
  selectedAgent: number;
  focusedColumn: number; // 0=repos, 1=skills, 2=detail
  isMarketMode: boolean;

  // UI
  loading: boolean;
  searchQuery: string;
  searchActive: boolean;
  confirmAction: { type: string; message: string; onConfirm: () => void } | null;
  statusMessage: string;

  // Actions
  setRepos: (repos: Repo[]) => void;
  setMarketResults: (results: MarketSkill[]) => void;
  setConfig: (config: Config) => void;
  selectRepo: (index: number) => void;
  selectSkill: (index: number) => void;
  selectAgent: (index: number) => void;
  focusNext: () => void;
  focusPrev: () => void;
  setMarketMode: (on: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
  setConfirmAction: (action: SkillsState["confirmAction"]) => void;
  setStatusMessage: (msg: string) => void;
}

export function createSkillsStore() {
  return createStore<SkillsState>((set) => ({
    repos: [],
    marketResults: [],
    config: null,
    selectedRepo: 0,
    selectedSkill: 0,
    selectedAgent: 0,
    focusedColumn: 0,
    isMarketMode: false,
    loading: true,
    searchQuery: "",
    searchActive: false,
    confirmAction: null,
    statusMessage: "",

    setRepos: (repos) => set({ repos, loading: false }),
    setMarketResults: (marketResults) => set({ marketResults }),
    setConfig: (config) => set({ config }),
    selectRepo: (index) => set({ selectedRepo: index, selectedSkill: 0, selectedAgent: 0 }),
    selectSkill: (index) => set({ selectedSkill: index, selectedAgent: 0 }),
    selectAgent: (index) => set({ selectedAgent: index }),
    focusNext: () => set((s) => ({ focusedColumn: (s.focusedColumn + 1) % 3 })),
    focusPrev: () => set((s) => ({ focusedColumn: (s.focusedColumn + 2) % 3 })),
    setMarketMode: (isMarketMode) => set({ isMarketMode, selectedSkill: 0 }),
    setLoading: (loading) => set({ loading }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSearchActive: (searchActive) => set({ searchActive }),
    setConfirmAction: (confirmAction) => set({ confirmAction }),
    setStatusMessage: (statusMessage) => set({ statusMessage }),
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
bun run test -- tests/useSkills.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSkills.ts tests/useSkills.test.ts
git commit -m "feat: add zustand store for skills state management"
```

---

### Task 9: App shell with ink

**Files:**
- Create: `src/app.tsx`
- Create: `src/components/Header.tsx`
- Create: `src/components/StatusBar.tsx`

- [ ] **Step 1: Create entry point**

```tsx
// src/app.tsx
#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./components/App.js";

render(<App />);
```

- [ ] **Step 2: Create App component (placeholder layout)**

```tsx
// src/components/App.tsx
import React from "react";
import { Box, Text } from "ink";
import { Header } from "./Header.js";
import { StatusBar } from "./StatusBar.js";

export function App() {
  return (
    <Box flexDirection="column" width="100%">
      <Header />
      <Box flexGrow={1}>
        <Text>Loading...</Text>
      </Box>
      <StatusBar message="" />
    </Box>
  );
}
```

- [ ] **Step 3: Create Header component**

```tsx
// src/components/Header.tsx
import React from "react";
import { Box, Text } from "ink";

export function Header() {
  return (
    <Box borderStyle="single" borderBottom borderColor="gray" paddingX={1}>
      <Text bold>skills-tui</Text>
      <Text color="gray"> v0.1.0</Text>
    </Box>
  );
}
```

- [ ] **Step 4: Create StatusBar component**

```tsx
// src/components/StatusBar.tsx
import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  message: string;
}

export function StatusBar({ message }: StatusBarProps) {
  return (
    <Box borderStyle="single" borderTop borderColor="gray" paddingX={1}>
      <Text color="gray">
        Tab:switch  /:search  a:add  d:disable  e:enable  x:delete  q:quit
      </Text>
      {message && (
        <>
          <Text color="gray"> | </Text>
          <Text color="yellow">{message}</Text>
        </>
      )}
    </Box>
  );
}
```

- [ ] **Step 5: Verify app runs**

```bash
bun run src/app.tsx
```
Expected: TUI renders with header and status bar. Press `q` or `Ctrl+C` to exit.

- [ ] **Step 6: Commit**

```bash
git add src/app.tsx src/components/App.tsx src/components/Header.tsx src/components/StatusBar.tsx
git commit -m "feat: add app shell with ink (header + status bar)"
```

---

## Chunk 5: Core UI Components

### Task 10: RepoList component (left column)

**Files:**
- Create: `src/components/RepoList.tsx`

- [ ] **Step 1: Implement RepoList**

```tsx
// src/components/RepoList.tsx
import React from "react";
import { Box, Text } from "ink";
import type { Repo } from "../types.js";

interface RepoListProps {
  repos: Repo[];
  selectedIndex: number;
  focused: boolean;
  isMarketMode: boolean;
  onSelect: (index: number) => void;
  onMarketToggle: () => void;
}

export function RepoList({ repos, selectedIndex, focused, isMarketMode, onSelect, onMarketToggle }: RepoListProps) {
  const borderColor = focused ? "blue" : "gray";

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="30%">
      <Box paddingX={1}>
        <Text bold color={focused ? "blue" : "white"}>Repos</Text>
      </Box>
      {repos.map((repo, i) => {
        const isSelected = !isMarketMode && i === selectedIndex;
        const prefix = isSelected ? "▶" : " ";
        const shortName = repo.source.length > 18 ? repo.source.slice(0, 17) + "…" : repo.source;
        return (
          <Box key={repo.source} paddingX={1}>
            <Text
              color={isSelected ? "blue" : "white"}
              bold={isSelected}
            >
              {prefix} {shortName}
            </Text>
            <Text color="gray"> ({repo.skillCount})</Text>
          </Box>
        );
      })}
      <Box paddingX={1} marginTop={1} borderStyle="single" borderTop borderColor="gray">
        <Text
          color={isMarketMode ? "green" : "gray"}
          bold={isMarketMode}
        >
          {isMarketMode ? "▶" : "▷"} Market
        </Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RepoList.tsx
git commit -m "feat: add RepoList component (left column)"
```

---

### Task 11: SkillList component (center column)

**Files:**
- Create: `src/components/SkillList.tsx`

- [ ] **Step 1: Implement SkillList**

```tsx
// src/components/SkillList.tsx
import React from "react";
import { Box, Text } from "ink";
import type { LocalSkill, MarketSkill } from "../types.js";
import { isEnabled } from "../types.js";
import { formatInstalls } from "../services/market.js";

interface SkillListProps {
  skills: LocalSkill[];
  marketResults: MarketSkill[];
  isMarketMode: boolean;
  selectedIndex: number;
  focused: boolean;
  searchQuery: string;
}

export function SkillList({ skills, marketResults, isMarketMode, selectedIndex, focused, searchQuery }: SkillListProps) {
  const borderColor = focused ? "blue" : "gray";

  if (isMarketMode) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
        <Box paddingX={1}>
          <Text bold color={focused ? "blue" : "white"}>Market</Text>
          {searchQuery && <Text color="gray"> "{searchQuery}"</Text>}
        </Box>
        {marketResults.length === 0 && (
          <Box paddingX={1}>
            <Text color="gray">{searchQuery ? "No results" : "Press / to search"}</Text>
          </Box>
        )}
        {marketResults.map((skill, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={skill.id} paddingX={1}>
              <Text color={isSelected ? "blue" : "white"} bold={isSelected}>
                {isSelected ? "▶" : " "} {skill.name}
              </Text>
              <Text color="cyan"> {formatInstalls(skill.installs)}</Text>
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
      <Box paddingX={1}>
        <Text bold color={focused ? "blue" : "white"}>Skills</Text>
      </Box>
      {skills.map((skill, i) => {
        const isSelected = i === selectedIndex;
        const enabled = isEnabled(skill);
        const statusIcon = !skill.managed ? "⚠" : enabled ? "●" : "○";
        const statusColor = !skill.managed ? "yellow" : enabled ? "green" : "gray";

        return (
          <Box key={skill.name} paddingX={1}>
            <Text color={statusColor}>{statusIcon}</Text>
            <Text
              color={isSelected ? "blue" : skill.managed ? "white" : "gray"}
              bold={isSelected}
              dimColor={!skill.managed}
            >
              {isSelected ? " ▶" : "  "} {skill.name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SkillList.tsx
git commit -m "feat: add SkillList component (center column)"
```

---

### Task 12: DetailPanel component (right column)

**Files:**
- Create: `src/components/DetailPanel.tsx`

- [ ] **Step 1: Implement DetailPanel**

```tsx
// src/components/DetailPanel.tsx
import React from "react";
import { Box, Text } from "ink";
import type { LocalSkill, MarketSkill } from "../types.js";
import { isEnabled } from "../types.js";
import { formatInstalls } from "../services/market.js";

interface DetailPanelProps {
  skill: LocalSkill | null;
  marketSkill: MarketSkill | null;
  isMarketMode: boolean;
  focused: boolean;
  selectedAgent: number;
}

export function DetailPanel({ skill, marketSkill, isMarketMode, focused, selectedAgent }: DetailPanelProps) {
  const borderColor = focused ? "blue" : "gray";

  if (isMarketMode && marketSkill) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
        <Box paddingX={1}>
          <Text bold color={focused ? "blue" : "white"}>Detail</Text>
        </Box>
        <Box flexDirection="column" paddingX={1} gap={0}>
          <Text bold>{marketSkill.name}</Text>
          <Text color="gray">Source: {marketSkill.source}</Text>
          <Text color="cyan">Installs: {formatInstalls(marketSkill.installs)}</Text>
          <Box marginTop={1}>
            <Text color="green">Press Enter to install</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (!skill) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
        <Box paddingX={1}>
          <Text bold color={focused ? "blue" : "white"}>Detail</Text>
        </Box>
        <Box paddingX={1}>
          <Text color="gray">Select a skill</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
      <Box paddingX={1}>
        <Text bold color={focused ? "blue" : "white"}>Detail</Text>
      </Box>
      <Box flexDirection="column" paddingX={1} gap={0}>
        <Text bold>{skill.name}</Text>
        {!skill.managed && <Text color="yellow">[manual]</Text>}
        <Text color="gray">Source: {skill.repo}</Text>
        <Text color="gray">Path: {skill.canonicalPath}</Text>
        <Text>Enabled: {isEnabled(skill) ? <Text color="green">✔</Text> : <Text color="red">✘</Text>}</Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Agents:</Text>
          {skill.agents.map((binding, i) => {
            const isHighlighted = focused && i === selectedAgent;
            const icon = binding.linked ? "✔" : "☐";
            const color = binding.linked ? "green" : "gray";
            return (
              <Box key={binding.agent} paddingLeft={1}>
                <Text
                  color={isHighlighted ? "blue" : color}
                  bold={isHighlighted}
                  inverse={isHighlighted}
                >
                  {icon} {binding.agent}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: add DetailPanel component (right column with agent bindings)"
```

---

### Task 13: MillerColumns layout + keyboard navigation

**Files:**
- Create: `src/components/MillerColumns.tsx`
- Create: `src/hooks/useFocus.ts`
- Modify: `src/components/App.tsx`

- [ ] **Step 1: Create useFocus hook for keyboard handling**

```tsx
// src/hooks/useFocus.ts
import { useInput } from "ink";
import type { SkillsState } from "./useSkills.js";

interface UseFocusOptions {
  store: SkillsState;
  onQuit: () => void;
  onSearch: () => void;
  onAdd: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  onEnter: () => void;
  onToggle: () => void;
  getListLength: (column: number) => number;
}

export function useKeyboard(opts: UseFocusOptions) {
  const { store } = opts;

  useInput((input, key) => {
    // Global keys
    if (input === "q" || (key.ctrl && input === "c")) {
      opts.onQuit();
      return;
    }
    if (input === "/") {
      opts.onSearch();
      return;
    }

    // Tab navigation
    if (key.tab) {
      if (key.shift) {
        store.focusPrev();
      } else {
        store.focusNext();
      }
      return;
    }

    // List navigation
    if (key.upArrow || input === "k") {
      const col = store.focusedColumn;
      if (col === 0) store.selectRepo(Math.max(0, store.selectedRepo - 1));
      else if (col === 1) store.selectSkill(Math.max(0, store.selectedSkill - 1));
      else if (col === 2) store.selectAgent(Math.max(0, store.selectedAgent - 1));
      return;
    }
    if (key.downArrow || input === "j") {
      const col = store.focusedColumn;
      const max = opts.getListLength(col) - 1;
      if (col === 0) store.selectRepo(Math.min(max, store.selectedRepo + 1));
      else if (col === 1) store.selectSkill(Math.min(max, store.selectedSkill + 1));
      else if (col === 2) store.selectAgent(Math.min(max, store.selectedAgent + 1));
      return;
    }

    if (key.return) { opts.onEnter(); return; }

    // Operations
    if (input === "a") { opts.onAdd(); return; }
    if (input === "d") { opts.onDisable(); return; }
    if (input === "e") { opts.onEnable(); return; }
    if (input === "D") { opts.onDisableAll(); return; }
    if (input === "E") { opts.onEnableAll(); return; }
    if (input === "x") { opts.onDelete(); return; }
    if (input === "u") { opts.onUpdate(); return; }
    if (input === " ") { opts.onToggle(); return; } // Space = toggle current agent binding
  });
}
```

- [ ] **Step 2: Create MillerColumns container**

```tsx
// src/components/MillerColumns.tsx
import React from "react";
import { Box, useStdout } from "ink";
import { RepoList } from "./RepoList.js";
import { SkillList } from "./SkillList.js";
import { DetailPanel } from "./DetailPanel.js";
import type { Repo, LocalSkill, MarketSkill } from "../types.js";

interface MillerColumnsProps {
  repos: Repo[];
  currentSkills: LocalSkill[];
  marketResults: MarketSkill[];
  isMarketMode: boolean;
  selectedRepo: number;
  selectedSkill: number;
  selectedAgent: number;
  focusedColumn: number;
  searchQuery: string;
  onSelectRepo: (i: number) => void;
  onMarketToggle: () => void;
}

export function MillerColumns(props: MillerColumnsProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 120;

  const currentSkill = props.currentSkills[props.selectedSkill] ?? null;
  const currentMarketSkill = props.marketResults[props.selectedSkill] ?? null;

  // Responsive: hide detail below 100, single focused column below 50
  const singleColumn = cols < 50;
  const showDetail = cols >= 100;

  return (
    <Box flexGrow={1}>
      {(!singleColumn || props.focusedColumn === 0) && (
        <RepoList
          repos={props.repos}
          selectedIndex={props.selectedRepo}
          focused={props.focusedColumn === 0}
          isMarketMode={props.isMarketMode}
          onSelect={props.onSelectRepo}
          onMarketToggle={props.onMarketToggle}
        />
      )}
      {(!singleColumn || props.focusedColumn === 1) && (
        <SkillList
          skills={props.currentSkills}
          marketResults={props.marketResults}
          isMarketMode={props.isMarketMode}
          selectedIndex={props.selectedSkill}
          focused={props.focusedColumn === 1}
          searchQuery={props.searchQuery}
        />
      )}
      {showDetail && (
        <DetailPanel
          skill={currentSkill}
          marketSkill={currentMarketSkill}
          isMarketMode={props.isMarketMode}
          focused={props.focusedColumn === 2}
          selectedAgent={props.selectedAgent}
        />
      )}
    </Box>
  );
}
```

- [ ] **Step 3: Wire up App with store and keyboard**

Update `src/components/App.tsx` to integrate store, data loading, and keyboard navigation. Connect MillerColumns, load data from scanner on mount, wire all keyboard handlers to store actions and service calls.

- [ ] **Step 4: Manual test**

```bash
bun run src/app.tsx
```
Expected: Three-column layout shows installed skills. Tab switches focus. j/k navigates. q quits.

- [ ] **Step 5: Commit**

```bash
git add src/components/MillerColumns.tsx src/hooks/useFocus.ts src/components/App.tsx
git commit -m "feat: add MillerColumns layout with keyboard navigation"
```

---

### Task 14: SearchOverlay + ConfirmDialog

**Files:**
- Create: `src/components/SearchOverlay.tsx`
- Create: `src/components/ConfirmDialog.tsx`

- [ ] **Step 1: Implement SearchOverlay**

```tsx
// src/components/SearchOverlay.tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface SearchOverlayProps {
  onSubmit: (query: string) => void;
  onCancel: () => void;
}

export function SearchOverlay({ onSubmit, onCancel }: SearchOverlayProps) {
  const [query, setQuery] = useState("");

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  return (
    <Box
      position="absolute"
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
      marginTop={2}
      marginX={4}
    >
      <Box>
        <Text color="blue">/ </Text>
        <TextInput value={query} onChange={setQuery} onSubmit={() => onSubmit(query)} />
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Implement ConfirmDialog**

```tsx
// src/components/ConfirmDialog.tsx
import React from "react";
import { Box, Text, useInput } from "ink";

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  useInput((input, key) => {
    if (input === "y" || input === "Y" || key.return) {
      onConfirm();
    } else if (input === "n" || input === "N" || key.escape) {
      onCancel();
    }
  });

  return (
    <Box
      position="absolute"
      flexDirection="column"
      borderStyle="round"
      borderColor="red"
      paddingX={2}
      paddingY={1}
      marginTop={4}
      marginX={8}
    >
      <Text>{message}</Text>
      <Box marginTop={1}>
        <Text color="green">[y]</Text>
        <Text> Confirm  </Text>
        <Text color="red">[n]</Text>
        <Text> Cancel</Text>
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Wire overlays into App**

Update `App.tsx` to conditionally render `SearchOverlay` and `ConfirmDialog` based on store state.

- [ ] **Step 4: Manual test**

```bash
bun run src/app.tsx
```
Expected: Press `/` to open search overlay. Press `x` on a skill to see confirm dialog. Esc cancels both.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchOverlay.tsx src/components/ConfirmDialog.tsx src/components/App.tsx
git commit -m "feat: add SearchOverlay and ConfirmDialog components"
```

---

## Chunk 6: Integration + Data Loading

### Task 15: Wire data loading and operations into App

**Files:**
- Create: `src/hooks/useSearch.ts`
- Modify: `src/components/App.tsx`

- [ ] **Step 1: Create useSearch hook with debounce**

```typescript
// src/hooks/useSearch.ts
import { useState, useEffect, useRef } from "react";
import { searchMarket } from "../services/market.js";
import type { MarketSkill } from "../types.js";

export function useMarketSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<MarketSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || !query || query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      const res = await searchMarket(query);
      setResults(res);
      setLoading(false);
    }, 150);

    return () => clearTimeout(timerRef.current);
  }, [query, enabled]);

  return { results, loading };
}
```

- [ ] **Step 2: Complete App.tsx with full data loading**

Wire up `App.tsx` to:
1. On mount: read config, read lock file, scan canonical root, resolve agent bindings, group into repos
2. Set repos into store
3. Handle all keyboard actions: enable/disable calls linker, add/remove calls repo service, search calls market
4. Refresh data after mutations

Key integration logic:
```typescript
// Pseudocode for loadData()
const config = await readConfig();
const lockPath = join(homedir(), ".agents", ".skill-lock.json");
const lockData = await readLockFile(lockPath);
const lockGroups = parseLockFile(lockData);
// Invert: skillName → source
const skillToSource: Record<string, string> = {};
for (const [source, skills] of lockGroups) {
  for (const skill of skills) skillToSource[skill] = source;
}
const scannedSkills = await scanInstalledSkills(CANONICAL_ROOT, skillToSource);
// For each skill, resolve agent bindings
const agentInfos = getAgentInfos(); // extract from known agents
const fullSkills = await Promise.all(
  scannedSkills.map(async (s) => ({
    ...s,
    agents: await resolveAgentBindings(s.name, agentInfos, CANONICAL_ROOT),
  }))
);
// Group into repos
const repoMap = new Map<string, LocalSkill[]>();
for (const skill of fullSkills) {
  const list = repoMap.get(skill.repo) ?? [];
  list.push(skill);
  repoMap.set(skill.repo, list);
}
const repos: Repo[] = [...repoMap.entries()].map(([source, skills]) => ({
  source, url: `https://github.com/${source}`, skills, skillCount: skills.length,
}));
store.setRepos(repos);
```

- [ ] **Step 3: Manual end-to-end test**

```bash
bun run src/app.tsx
```
Expected: App loads real installed skills, displays in three columns. All keyboard shortcuts work. Enable/disable toggles symlinks. Market search returns results.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useSearch.ts src/components/App.tsx
git commit -m "feat: wire data loading, keyboard ops, and market search"
```

---

## Chunk 7: Build, CI/CD, Distribution

### Task 16: Build configuration

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Test bun compile**

```bash
bun build --compile src/app.tsx --outfile skills-tui
./skills-tui
```
Expected: Single binary runs the TUI.

- [ ] **Step 2: Add build script to package.json**

Ensure `package.json` has:
```json
{
  "scripts": {
    "build": "bun build --compile src/app.tsx --outfile skills-tui",
    "build:all": "bun build --compile --target=bun-darwin-arm64 src/app.tsx --outfile skills-tui-darwin-arm64 && bun build --compile --target=bun-darwin-x64 src/app.tsx --outfile skills-tui-darwin-x64 && bun build --compile --target=bun-linux-x64 src/app.tsx --outfile skills-tui-linux-x64"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add build scripts for single binary compilation"
```

---

### Task 17: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint
      - run: bun run type-check
      - run: bun run test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint + type-check + test workflow"
```

---

### Task 18: Release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create release workflow**

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  build:
    strategy:
      matrix:
        include:
          - target: bun-darwin-arm64
            artifact: skills-tui-darwin-arm64
            os: macos-latest
          - target: bun-darwin-x64
            artifact: skills-tui-darwin-x64
            os: macos-latest
          - target: bun-linux-x64
            artifact: skills-tui-linux-x64
            os: ubuntu-latest
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun build --compile --target=${{ matrix.target }} src/app.tsx --outfile ${{ matrix.artifact }}
      - run: shasum -a 256 ${{ matrix.artifact }} > ${{ matrix.artifact }}.sha256
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: |
            ${{ matrix.artifact }}
            ${{ matrix.artifact }}.sha256

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with:
          merge-multiple: true
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            skills-tui-*
          generate_release_notes: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow (multi-platform bun compile + GitHub Release)"
```

---

### Task 19: Homebrew workflow

**Files:**
- Create: `.github/workflows/homebrew.yml`

- [ ] **Step 1: Create Homebrew update workflow**

```yaml
# .github/workflows/homebrew.yml
name: Update Homebrew
on:
  release:
    types: [published]

jobs:
  update-tap:
    runs-on: ubuntu-latest
    steps:
      - name: Get release info
        id: release
        run: |
          TAG="${GITHUB_REF#refs/tags/}"
          echo "tag=$TAG" >> $GITHUB_OUTPUT
          echo "version=${TAG#v}" >> $GITHUB_OUTPUT

      - name: Download SHA256 files
        run: |
          BASE_URL="https://github.com/${{ github.repository }}/releases/download/${{ steps.release.outputs.tag }}"
          curl -fsSL "$BASE_URL/skills-tui-darwin-arm64.sha256" -o arm64.sha256
          curl -fsSL "$BASE_URL/skills-tui-darwin-x64.sha256" -o x64.sha256
          echo "sha256_arm64=$(cut -d' ' -f1 arm64.sha256)" >> $GITHUB_OUTPUT
          echo "sha256_x64=$(cut -d' ' -f1 x64.sha256)" >> $GITHUB_OUTPUT
        id: sha

      - uses: actions/checkout@v4
        with:
          repository: kassol/homebrew-tap
          token: ${{ secrets.TAP_TOKEN }}

      - name: Update formula
        run: |
          cat > Formula/skills-tui.rb << 'FORMULA'
          class SkillsTui < Formula
            desc "TUI for managing global agent skills"
            homepage "https://github.com/kassol/skills-tui"
            version "${{ steps.release.outputs.version }}"
            license "MIT"

            on_macos do
              if Hardware::CPU.arm?
                url "https://github.com/kassol/skills-tui/releases/download/${{ steps.release.outputs.tag }}/skills-tui-darwin-arm64"
                sha256 "${{ steps.sha.outputs.sha256_arm64 }}"
              else
                url "https://github.com/kassol/skills-tui/releases/download/${{ steps.release.outputs.tag }}/skills-tui-darwin-x64"
                sha256 "${{ steps.sha.outputs.sha256_x64 }}"
              end
            end

            def install
              bin.install Dir["skills-tui-*"].first => "skills-tui"
            end

            test do
              assert_match "skills-tui", shell_output("#{bin}/skills-tui --version")
            end
          end
          FORMULA

      - name: Commit and push
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add Formula/skills-tui.rb
          git commit -m "Update skills-tui to ${{ steps.release.outputs.version }}"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/homebrew.yml
git commit -m "ci: add Homebrew formula auto-update workflow"
```

---

### Task 20: README + AGENTS.md + CONTRIBUTING.md

**Files:**
- Create: `README.md`
- Create: `AGENTS.md`
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Create README.md**

Include: project description, screenshot placeholder, installation (Homebrew + binary + source), usage (keyboard shortcuts), features list, development setup, license.

- [ ] **Step 2: Create AGENTS.md**

Project overview, directory structure, tech stack, common commands (`bun run dev`, `bun run test`, `bun run build`), architecture notes.

- [ ] **Step 3: Create CONTRIBUTING.md**

Prerequisites (Bun ≥1.0), setup steps, PR guidelines, testing expectations.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md CONTRIBUTING.md
git commit -m "docs: add README, AGENTS.md, and CONTRIBUTING guide"
```

---

### Task 21: --version flag and agent registry

**Files:**
- Modify: `src/app.tsx`
- Create: `src/agents.ts`

- [ ] **Step 1: Add --version handling to app entry**

```typescript
// Add to top of src/app.tsx, before render()
const args = process.argv.slice(2);
if (args.includes("--version") || args.includes("-v")) {
  console.log("skills-tui v0.1.0");
  process.exit(0);
}
```

- [ ] **Step 2: Create agent registry**

```typescript
// src/agents.ts
import { join } from "path";
import { homedir } from "os";
import type { AgentInfo, AgentType } from "./types";

const home = homedir();

export const KNOWN_AGENTS: AgentInfo[] = [
  { name: "claude-code", displayName: "Claude Code", globalSkillsDir: join(home, ".claude", "skills") },
  { name: "codex", displayName: "Codex", globalSkillsDir: join(home, ".codex", "skills") },
  { name: "cursor", displayName: "Cursor", globalSkillsDir: join(home, ".cursor", "skills") },
  { name: "gemini-cli", displayName: "Gemini CLI", globalSkillsDir: join(home, ".gemini", "skills") },
  { name: "opencode", displayName: "OpenCode", globalSkillsDir: join(home, ".config", "opencode", "skills") },
  { name: "windsurf", displayName: "Windsurf", globalSkillsDir: join(home, ".windsurf", "skills") },
  { name: "amp", displayName: "Amp", globalSkillsDir: join(home, ".config", "agents", "skills") },
  { name: "goose", displayName: "Goose", globalSkillsDir: join(home, ".config", "goose", "skills") },
  { name: "roo", displayName: "Roo", globalSkillsDir: join(home, ".roo", "skills") },
  { name: "cline", displayName: "Cline", globalSkillsDir: join(home, ".cline", "skills") },
];

export function getAgentInfos(): AgentInfo[] {
  return KNOWN_AGENTS;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app.tsx src/agents.ts
git commit -m "feat: add --version flag and agent registry"
```

---

### Task 22: Local fuzzy filter, non-managed guard, offline state

**Files:**
- Modify: `src/hooks/useSearch.ts`
- Modify: `src/hooks/useFocus.ts`
- Modify: `src/services/market.ts`

- [ ] **Step 1: Add local fuzzy filter to useSearch**

```typescript
// Add to src/hooks/useSearch.ts
export function filterLocal<T extends { name: string }>(items: T[], query: string): T[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(lower));
}
```

- [ ] **Step 2: Add non-managed guard to keyboard handlers**

In the keyboard handler (`useFocus.ts`), before calling `onDisable`/`onEnable`/`onDelete`, check that the currently selected skill has `managed === true`. If not, set status message "Cannot operate on non-managed skill" and return.

- [ ] **Step 3: Add offline detection to market service**

```typescript
// Add to src/services/market.ts
export async function checkMarketOnline(): Promise<boolean> {
  try {
    const res = await fetch("https://skills.sh/api/search?q=test&limit=1");
    return res.ok;
  } catch {
    return false;
  }
}
```

Show "Market offline" in SkillList when market mode is active but API is unreachable.

- [ ] **Step 4: Add E/D confirmation dialogs**

In App.tsx keyboard handlers, `onDisableAll` and `onEnableAll` must go through `setConfirmAction()` with appropriate message before executing.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSearch.ts src/hooks/useFocus.ts src/services/market.ts src/components/App.tsx
git commit -m "feat: add local filter, non-managed guard, offline state, E/D confirmation"
```

---

### Task 23: Final verification

- [ ] **Step 1: Run full check suite**

```bash
bun run lint && bun run type-check && bun run test
```
Expected: All pass.

- [ ] **Step 2: Build binary**

```bash
bun run build
./skills-tui
```
Expected: Binary launches TUI successfully.

- [ ] **Step 3: Rename branch to main**

```bash
git branch -m master main
```

- [ ] **Step 4: Tag v0.1.0**

```bash
git tag v0.1.0
```
