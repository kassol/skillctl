import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
  } catch (err: unknown) {
    // Only return defaults for missing file; rethrow parse/IO errors
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_CONFIG };
    }
    throw err;
  }
}

export async function writeConfig(path: string, config: Config): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  // Atomic write: write to temp file, then rename
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, JSON.stringify(config, null, 2), "utf-8");
  await rename(tmpPath, path);
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
