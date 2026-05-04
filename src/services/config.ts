import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import {
  APP_NAME,
  CONFIG_VERSION,
  type Config,
  type JsonValue,
  type SourceConfig,
} from "../types.js";
import { defaultConfigPath, defaultGlobalStore, defaultLockFile, expandHome } from "./paths.js";

const runtimeSchema = z.object({
  globalStore: z.string().default("~/.agents/skills"),
  lockFile: z.string().default("~/.agents/.skill-lock.json"),
  npx: z.string().default("npx --yes skills"),
});

const sourceSchema = z.object({
  path: z.string(),
  remote: z.string().optional(),
  installRef: z.string(),
  defaultAgents: z.array(z.string()).default(["*"]),
  publishBranch: z.string().default("main"),
  fullDepth: z.boolean().default(false),
});

const configSchema = z.object({
  version: z.literal(CONFIG_VERSION).default(CONFIG_VERSION),
  runtime: runtimeSchema.partial().optional(),
  sources: z.record(z.string(), sourceSchema).default({}),
});

export function defaultConfig(): Config {
  return {
    version: CONFIG_VERSION,
    runtime: {
      globalStore: defaultGlobalStore(),
      lockFile: defaultLockFile(),
      npx: "npx --yes skills",
    },
    sources: {},
  };
}

export function normalizeConfig(raw: unknown): Config {
  const parsed = configSchema.parse(raw ?? {});
  const runtime = runtimeSchema.parse(parsed.runtime ?? {});
  return {
    version: CONFIG_VERSION,
    runtime: {
      globalStore: expandHome(runtime.globalStore),
      lockFile: expandHome(runtime.lockFile),
      npx: runtime.npx,
    },
    sources: Object.fromEntries(
      Object.entries(parsed.sources).map(([name, source]) => [name, normalizeSource(source)]),
    ),
  };
}

export function normalizeSource(source: SourceConfig): SourceConfig {
  return {
    ...source,
    path: expandHome(source.path),
    defaultAgents: source.defaultAgents.length > 0 ? source.defaultAgents : ["*"],
    publishBranch: source.publishBranch || "main",
    fullDepth: Boolean(source.fullDepth),
  };
}

export function getConfigPath(override?: string): string {
  return expandHome(override ?? process.env.SKILLCTL_CONFIG ?? defaultConfigPath());
}

export async function readConfig(path?: string): Promise<Config> {
  const configPath = getConfigPath(path);
  try {
    const raw = await readFile(configPath, "utf-8");
    return normalizeConfig(JSON.parse(raw));
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultConfig();
    }
    throw err;
  }
}

export async function writeConfig(path: string | undefined, config: Config): Promise<void> {
  const configPath = getConfigPath(path);
  await mkdir(dirname(configPath), { recursive: true });
  const tmpPath = `${configPath}.tmp`;
  const persisted: Config = {
    version: CONFIG_VERSION,
    runtime: config.runtime,
    sources: config.sources,
  };
  await writeFile(tmpPath, `${JSON.stringify(persisted, null, 2)}\n`, "utf-8");
  await rename(tmpPath, configPath);
}

export async function initConfig(
  path?: string,
  force = false,
): Promise<{ path: string; created: boolean }> {
  const configPath = getConfigPath(path);
  if (!force) {
    try {
      await readFile(configPath, "utf-8");
      return { path: configPath, created: false };
    } catch (err: unknown) {
      if (
        !(err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT")
      ) {
        throw err;
      }
    }
  }
  await writeConfig(configPath, defaultConfig());
  return { path: configPath, created: true };
}

export function parseConfigValue(input: string): JsonValue {
  const trimmed = input.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    return JSON.parse(trimmed) as JsonValue;
  }
  return input;
}

function asMutableObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Config path traverses a non-object value");
  }
  return value as Record<string, unknown>;
}

export function getConfigValue(config: Config, key: string): unknown {
  const parts = key.split(".").filter(Boolean);
  let current: unknown = config;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setConfigValue(config: Config, key: string, value: JsonValue): Config {
  const clone = structuredClone(config) as Config;
  const parts = key.split(".").filter(Boolean);
  if (parts.length === 0) throw new Error("Config key cannot be empty");
  let current: Record<string, unknown> = clone as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    if (current[part] === undefined) current[part] = {};
    current = asMutableObject(current[part]);
  }
  current[parts.at(-1) as string] = value;
  return normalizeConfig(clone);
}

export function unsetConfigValue(config: Config, key: string): Config {
  const clone = structuredClone(config) as Config;
  const parts = key.split(".").filter(Boolean);
  if (parts.length === 0) throw new Error("Config key cannot be empty");
  let current: Record<string, unknown> = clone as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    if (current[part] === undefined) return normalizeConfig(clone);
    current = asMutableObject(current[part]);
  }
  delete current[parts.at(-1) as string];
  return normalizeConfig(clone);
}

export function flattenConfig(config: Config): Array<[string, unknown]> {
  const rows: Array<[string, unknown]> = [];
  function walk(prefix: string, value: unknown): void {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) {
        walk(prefix ? `${prefix}.${key}` : key, child);
      }
      return;
    }
    rows.push([prefix, value]);
  }
  walk("", config);
  return rows;
}

export function editConfig(path?: string): void {
  const configPath = getConfigPath(path);
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";
  const result = spawnSync(editor, [configPath], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status && result.status !== 0) {
    throw new Error(`${editor} exited with ${result.status}`);
  }
}

export function sourceDefaults(input: {
  path: string;
  installRef: string;
  remote?: string;
  defaultAgents?: string[];
  publishBranch?: string;
  fullDepth?: boolean;
}): SourceConfig {
  return normalizeSource({
    path: input.path,
    installRef: input.installRef,
    remote: input.remote,
    defaultAgents: input.defaultAgents?.length ? input.defaultAgents : ["*"],
    publishBranch: input.publishBranch ?? "main",
    fullDepth: input.fullDepth ?? false,
  });
}

export function appConfigDirMessage(path?: string): string {
  return `${APP_NAME} config: ${getConfigPath(path)}`;
}
