import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, normalize, resolve, sep } from "node:path";

export function homeDir(): string {
  return homedir();
}

export function expandHome(path: string): string {
  if (path === "~") return homeDir();
  if (path.startsWith("~/")) return resolve(homeDir(), path.slice(2));
  return path;
}

export function absolutize(path: string, base = process.cwd()): string {
  const expanded = expandHome(path);
  return isAbsolute(expanded) ? normalize(expanded) : resolve(base, expanded);
}

export function compactHome(path: string): string {
  const home = homeDir();
  const normalized = normalize(path);
  if (normalized === home) return "~";
  if (normalized.startsWith(home + sep)) return `~/${normalized.slice(home.length + 1)}`;
  return path;
}

export function defaultConfigPath(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME;
  return resolve(
    xdgConfig ? expandHome(xdgConfig) : resolve(homeDir(), ".config"),
    "skillctl",
    "config.json",
  );
}

export function defaultGlobalStore(): string {
  return resolve(homeDir(), ".agents", "skills");
}

export function defaultLockFile(): string {
  return resolve(homeDir(), ".agents", ".skill-lock.json");
}

export function defaultCacheDir(): string {
  const xdgCache = process.env.XDG_CACHE_HOME;
  return resolve(xdgCache ? expandHome(xdgCache) : resolve(homeDir(), ".cache"), "skillctl");
}

export function isSubPath(parent: string, child: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}

export function pathExists(path: string): boolean {
  return existsSync(expandHome(path));
}

export function ensureParent(path: string): string {
  return dirname(path);
}
