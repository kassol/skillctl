export const APP_NAME = "skillctl";
export const CONFIG_VERSION = 1 as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface RuntimeConfig {
  globalStore: string;
  lockFile: string;
  npx: string;
}

export interface SourceConfig {
  path: string;
  remote?: string;
  installRef: string;
  defaultAgents: string[];
  publishBranch: string;
  fullDepth: boolean;
}

export interface Config {
  version: typeof CONFIG_VERSION;
  runtime: RuntimeConfig;
  sources: Record<string, SourceConfig>;
}

export interface SkillManifest {
  slug: string;
  name: string;
  description: string;
  dir: string;
  skillFile: string;
  relativeDir: string;
}

export interface LockEntry {
  source?: string;
  sourceType?: string;
  sourceUrl?: string;
  skillPath?: string;
  skillFolderHash?: string;
  installedAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface LockFileData {
  version?: number;
  skills?: Record<string, LockEntry>;
}

export interface RuntimeSkill extends SkillManifest {
  lock?: LockEntry;
  source?: string;
}

export interface RepoSummary {
  repo: string;
  installed: number;
}

export interface RepoDiff {
  repo: string;
  repoTotal: number;
  installedTotal: number;
  remoteOnly: string[];
  installedOnly: string[];
  runtimeDrift: string[];
  warnings: string[];
}

export interface SourceDiff {
  source: string;
  localTotal: number;
  remoteTotal?: number;
  installedTotal: number;
  localOnly: string[];
  remoteOnly: string[];
  notInstalled: string[];
  installedOnly: string[];
  runtimeDrift: string[];
  providerOutOfSync: Record<string, string[]>;
  warnings: string[];
}

export type ProviderType = "native-global" | "dedicated" | "unknown";

export interface ProviderDefinition {
  slug: string;
  displayName: string;
  type: ProviderType;
  dir?: string;
}

export interface ProviderInventorySkill {
  name: string;
  path?: string;
  scope?: string;
  agents?: string[];
}

export type ProviderEntryStatus =
  | "SYNCED_BY_DESIGN"
  | "GLOBAL_ONLY"
  | "PROVIDER_ONLY"
  | "BROKEN_LINK"
  | "LINK_OK"
  | "LINK_WRONG_TARGET"
  | "COPY_OK"
  | "COPY_DRIFT"
  | "NOT_CHECKABLE";

export interface ProviderSkillStatus {
  skill: string;
  status: ProviderEntryStatus;
  detail?: string;
}

export interface ProviderStatus {
  provider: ProviderDefinition;
  statuses: ProviderSkillStatus[];
  summary: Record<ProviderEntryStatus, number>;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
  command: string[];
}

export interface WriteOptions {
  dryRun?: boolean;
  yes?: boolean;
  json?: boolean;
}
