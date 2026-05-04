import { spawn } from "node:child_process";
import type { CommandResult } from "../types.js";

export function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function formatCommand(args: string[]): string {
  return args.map(shellQuote).join(" ");
}

export function splitCommandLine(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const char of input.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (/\s/.test(char) && !quote) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }

  if (escaping) current += "\\";
  if (quote) throw new Error(`Unclosed quote in command: ${input}`);
  if (current) args.push(current);
  return args;
}

export async function runCommand(
  command: string[],
  options: { cwd?: string; stdin?: string; env?: NodeJS.ProcessEnv; passthrough?: boolean } = {},
): Promise<CommandResult> {
  if (command.length === 0) throw new Error("Cannot run an empty command");

  return new Promise((resolve) => {
    const proc = spawn(command[0], command.slice(1), {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.passthrough ? ["inherit", "inherit", "inherit"] : ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (!options.passthrough) {
      proc.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      if (options.stdin) {
        proc.stdin?.write(options.stdin);
      }
      proc.stdin?.end();
    }

    proc.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr, command });
    });
    proc.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error.message, command });
    });
  });
}

export async function requireSuccess(result: CommandResult): Promise<CommandResult> {
  if (result.code !== 0) {
    throw new Error(
      `${formatCommand(result.command)} failed (${result.code})\n${result.stderr || result.stdout}`,
    );
  }
  return result;
}
