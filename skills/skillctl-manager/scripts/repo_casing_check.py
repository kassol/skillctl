#!/usr/bin/env python3
"""Check skillctl repo refs against GitHub canonical full_name.

This helper intentionally prints a concise report instead of modifying files.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from typing import Any

GITHUB_SHORTHAND = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def load_repos(path: str | None) -> list[dict[str, Any]]:
    if path:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    else:
        result = subprocess.run(
            ["skillctl", "repo", "list", "--json"],
            check=True,
            text=True,
            capture_output=True,
        )
        data = json.loads(result.stdout)

    if not isinstance(data, list):
        raise SystemExit("Expected skillctl repo list --json to return a list")
    return [item for item in data if isinstance(item, dict)]


def github_canonical(ref: str, timeout: int) -> tuple[str, str | None]:
    url = f"https://api.github.com/repos/{ref}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "skillctl-manager",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            payload = json.load(response)
        return "OK", str(payload.get("full_name") or "")
    except urllib.error.HTTPError as exc:
        return f"HTTP {exc.code}", None
    except Exception as exc:  # noqa: BLE001 - CLI helper should report all errors.
        return type(exc).__name__, None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("json_file", nargs="?", help="Optional skillctl repo list --json file")
    parser.add_argument(
        "--skip",
        action="append",
        default=[],
        help="Repo ref to skip, repeatable. Useful for private repos.",
    )
    parser.add_argument("--timeout", type=int, default=15, help="GitHub API timeout seconds")
    args = parser.parse_args()

    skip = {item.lower() for item in args.skip}
    repos = load_repos(args.json_file)
    has_case_issue = False

    for item in repos:
        ref = str(item.get("repo") or "")
        installed = item.get("installed", "")
        if not ref:
            continue

        if ref.lower() in skip:
            print(f"SKIP  {ref:35} configured-skip   installed={installed}")
            continue

        if not GITHUB_SHORTHAND.match(ref):
            print(f"SKIP  {ref:35} non-github-ref    installed={installed}")
            continue

        status, canonical = github_canonical(ref, args.timeout)
        if status != "OK" or canonical is None:
            print(f"ERROR {ref:35} -> {status:12} installed={installed}")
            continue

        if canonical == ref:
            print(f"OK    {ref:35} -> {canonical}   installed={installed}")
        else:
            has_case_issue = True
            print(f"CASE? {ref:35} -> {canonical}   installed={installed}")

    return 2 if has_case_issue else 0


if __name__ == "__main__":
    raise SystemExit(main())
