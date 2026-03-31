import { spawn } from "child_process";
import type { AgentType } from "../types.js";

const SOURCE_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

function validateSource(source: string): void {
  if (!SOURCE_PATTERN.test(source)) {
    throw new Error(`Invalid source format: "${source}". Expected "owner/repo".`);
  }
}

export function checkNpxAvailable(): boolean {
  try {
    const result = Bun.spawnSync(["npx", "--version"], { stdio: ["ignore", "pipe", "pipe"] });
    return result.exitCode === 0;
  } catch { return false; }
}

export function buildAddCommand(source: string, agents: AgentType[], skill?: string): string[] {
  const cmd = ["npx", "skills", "add", source, "-g"];
  for (const agent of agents) { cmd.push("-a", agent); }
  cmd.push("-y");
  if (skill) { cmd.push("--skill", skill); }
  return cmd;
}

export function buildSyncCommand(): string[] {
  return ["npx", "skills", "update"];
}

export function buildRemoveCommand(skillName: string, agents: AgentType[]): string[] {
  const cmd = ["npx", "skills", "remove", skillName, "-g"];
  for (const agent of agents) { cmd.push("-a", agent); }
  cmd.push("-y");
  return cmd;
}

export async function execCommand(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(args[0], args.slice(1), {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => { stdout += data; });
    proc.stderr.on("data", (data) => { stderr += data; });
    proc.on("close", (code) => { resolve({ code: code ?? 1, stdout, stderr }); });
  });
}

export async function addRepo(source: string, agents: AgentType[], skill?: string): Promise<void> {
  validateSource(source);
  const cmd = buildAddCommand(source, agents, skill);
  const result = await execCommand(cmd);
  if (result.code !== 0) { throw new Error(`Failed to add ${source}: ${result.stderr}`); }
}

export async function updateAll(): Promise<void> {
  const cmd = buildSyncCommand();
  const result = await execCommand(cmd);
  if (result.code !== 0) { throw new Error(`Failed to update: ${result.stderr}`); }
}
