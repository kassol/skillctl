import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import type { LockEntry, SourceConfig } from "../types.js";
import { defaultCacheDir, expandHome } from "./paths.js";
import { requireSuccess, runCommand } from "./process.js";

const GITHUB_SHORTHAND = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function isGitHubShorthand(ref: string): boolean {
  return GITHUB_SHORTHAND.test(ref);
}

export function isLocalPathRef(ref: string): boolean {
  const expanded = expandHome(ref);
  return expanded.startsWith("/") || expanded.startsWith(".") || existsSync(expanded);
}

export function normalizeGitRemote(ref: string): string {
  let value = ref.trim();
  value = value.replace(/^git\+/, "");
  value = value.replace(/^ssh:\/\/git@github\.com\//i, "github.com/");
  value = value.replace(/^git@github\.com:/i, "github.com/");
  value = value.replace(/^https?:\/\//i, "");
  value = value.replace(/^www\./i, "");
  value = value.replace(/\.git$/i, "");
  value = value.replace(/^github\.com\//i, "");
  return value.toLowerCase();
}

export function normalizeRef(ref: string): string {
  const expanded = expandHome(ref.trim());
  if (isLocalPathRef(expanded)) return resolve(expanded);
  return normalizeGitRemote(expanded);
}

export function repoCloneUrl(ref: string): string {
  if (isGitHubShorthand(ref)) return `https://github.com/${ref}.git`;
  if (/^(https?:|ssh:|git@)/.test(ref)) return ref;
  throw new Error(`Cannot clone repo ref "${ref}". Use owner/repo, a Git URL, or a local path.`);
}

export function cacheKey(ref: string): string {
  return createHash("sha1").update(normalizeRef(ref)).digest("hex");
}

export function sourceRefCandidates(source: SourceConfig): Set<string> {
  const candidates = new Set<string>();
  candidates.add(normalizeRef(source.path));
  candidates.add(normalizeRef(source.installRef));
  if (source.remote) candidates.add(normalizeRef(source.remote));
  return candidates;
}

export function lockEntryMatchesSource(
  entry: LockEntry | undefined,
  source: SourceConfig,
): boolean {
  if (!entry) return false;
  const candidates = sourceRefCandidates(source);
  const entryRefs = [entry.source, entry.sourceUrl].filter((value): value is string =>
    Boolean(value),
  );
  return entryRefs.some((value) => candidates.has(normalizeRef(value)));
}

export function lockEntryMatchesRepo(entry: LockEntry | undefined, repoRef: string): boolean {
  if (!entry) return false;
  const wanted = normalizeRef(repoRef);
  const entryRefs = [entry.source, entry.sourceUrl].filter((value): value is string =>
    Boolean(value),
  );
  return entryRefs.some((value) => normalizeRef(value) === wanted);
}

export async function resolveRepoSnapshot(
  ref: string,
  options: { fullDepth?: boolean; refresh?: boolean; cacheDir?: string } = {},
): Promise<{ path: string; cached: boolean; ref: string }> {
  const expanded = expandHome(ref);
  if (isLocalPathRef(expanded) && existsSync(expanded)) {
    return { path: resolve(expanded), cached: false, ref };
  }

  const reposDir = join(options.cacheDir ?? defaultCacheDir(), "repos");
  await mkdir(reposDir, { recursive: true });
  const target = join(reposDir, `${cacheKey(ref)}-${basename(normalizeGitRemote(ref)) || "repo"}`);
  const cloneUrl = repoCloneUrl(ref);
  const depthArgs = options.fullDepth ? [] : ["--depth", "1"];

  if (!existsSync(join(target, ".git"))) {
    await requireSuccess(await runCommand(["git", "clone", ...depthArgs, cloneUrl, target]));
  } else if (options.refresh !== false) {
    await requireSuccess(await runCommand(["git", "-C", target, "fetch", ...depthArgs, "origin"]));
    const head = await runCommand([
      "git",
      "-C",
      target,
      "symbolic-ref",
      "--short",
      "refs/remotes/origin/HEAD",
    ]);
    const branch = head.code === 0 ? head.stdout.trim().replace(/^origin\//, "") : "main";
    await requireSuccess(
      await runCommand(["git", "-C", target, "reset", "--hard", `origin/${branch}`]),
    );
  }

  return { path: target, cached: true, ref };
}
