import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
import type { Config } from "../types.js";
import { DEFAULT_CONFIG } from "../types.js";

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
