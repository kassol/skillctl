import type { CommandResult, Config, SourceConfig } from "../types.js";
import { formatCommand, runCommand, splitCommandLine } from "./process.js";

export function skillsBaseCommand(config: Config): string[] {
  return splitCommandLine(config.runtime.npx || "npx --yes skills");
}

export function buildSkillsCommand(config: Config, args: string[]): string[] {
  return [...skillsBaseCommand(config), ...args];
}

export async function runSkillsCommand(
  config: Config,
  args: string[],
  options: { dryRun?: boolean; passthrough?: boolean } = {},
): Promise<CommandResult> {
  const command = buildSkillsCommand(config, args);
  if (options.dryRun) {
    return { code: 0, stdout: `${formatCommand(command)}\n`, stderr: "", command };
  }
  return runCommand(command, { passthrough: options.passthrough });
}

export function addSkillArgs(ref: string, skill: string, agents: string[]): string[] {
  const selectedAgents = agents.length > 0 ? agents : ["*"];
  return ["add", ref, "-g", "--skill", skill, "--agent", ...selectedAgents, "-y"];
}

export function sourceAgents(source: SourceConfig, override?: string[]): string[] {
  return override?.length ? override : source.defaultAgents.length ? source.defaultAgents : ["*"];
}

export async function addSkillFromRef(
  config: Config,
  ref: string,
  skill: string,
  agents: string[],
  options: { dryRun?: boolean; passthrough?: boolean } = {},
): Promise<CommandResult> {
  return runSkillsCommand(config, addSkillArgs(ref, skill, agents), options);
}

export async function listGlobalSkillsJson(config: Config): Promise<unknown[]> {
  const result = await runSkillsCommand(config, ["ls", "-g", "--json"]);
  if (result.code !== 0) return [];
  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
