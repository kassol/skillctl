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
