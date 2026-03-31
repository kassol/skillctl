import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentInfo } from "./types.js";

const home = homedir();

export const KNOWN_AGENTS: AgentInfo[] = [
  {
    name: "claude-code",
    displayName: "Claude Code",
    globalSkillsDir: join(home, ".claude", "skills"),
  },
  { name: "codex", displayName: "Codex", globalSkillsDir: join(home, ".codex", "skills") },
  { name: "cursor", displayName: "Cursor", globalSkillsDir: join(home, ".cursor", "skills") },
  {
    name: "gemini-cli",
    displayName: "Gemini CLI",
    globalSkillsDir: join(home, ".gemini", "skills"),
  },
  {
    name: "opencode",
    displayName: "OpenCode",
    globalSkillsDir: join(home, ".config", "opencode", "skills"),
  },
  {
    name: "windsurf",
    displayName: "Windsurf",
    globalSkillsDir: join(home, ".codeium", "windsurf", "skills"),
  },
  { name: "amp", displayName: "Amp", globalSkillsDir: join(home, ".config", "agents", "skills") },
  {
    name: "goose",
    displayName: "Goose",
    globalSkillsDir: join(home, ".config", "goose", "skills"),
  },
  { name: "roo", displayName: "Roo", globalSkillsDir: join(home, ".roo", "skills") },
  { name: "cline", displayName: "Cline", globalSkillsDir: join(home, ".cline", "skills") },
];

export function getAgentInfos(): AgentInfo[] {
  return KNOWN_AGENTS;
}
