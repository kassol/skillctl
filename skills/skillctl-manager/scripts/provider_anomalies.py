#!/usr/bin/env python3
"""Report skillctl provider anomalies without piping large JSON.

By default this command runs `skillctl provider status --json`, writes it to a
real temporary file, then parses that file. This avoids pipe truncation issues in
some compiled CLI environments.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any

DEFAULT_BAD_STATUSES = {
    "PROVIDER_ONLY",
    "BROKEN_LINK",
    "LINK_WRONG_TARGET",
    "COPY_DRIFT",
}


def collect_status_json() -> Path:
    handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        prefix="skillctl-provider-status-",
        suffix=".json",
        delete=False,
    )
    with handle:
        subprocess.run(
            ["skillctl", "provider", "status", "--json"],
            check=True,
            text=True,
            stdout=handle,
        )
    return Path(handle.name)


def load_status(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise SystemExit("Expected provider status JSON to be a list")
    return [item for item in data if isinstance(item, dict)]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "json_file",
        nargs="?",
        help="Optional existing skillctl provider status --json file",
    )
    parser.add_argument(
        "--status",
        action="append",
        dest="statuses",
        help="Status to report. Repeatable. Defaults to provider-only/broken/drift statuses.",
    )
    parser.add_argument(
        "--show-json-path",
        action="store_true",
        help="Print the temp JSON path when the command collects status itself.",
    )
    args = parser.parse_args()

    collected_path: Path | None = None
    path = Path(args.json_file) if args.json_file else collect_status_json()
    if not args.json_file:
        collected_path = path

    statuses = set(args.statuses or DEFAULT_BAD_STATUSES)
    data = load_status(path)

    found = False
    for provider in data:
        provider_info = provider.get("provider") or {}
        provider_name = provider_info.get("displayName") or provider_info.get("slug") or "unknown"
        provider_slug = provider_info.get("slug") or "unknown"
        rows = [
            item
            for item in provider.get("statuses", [])
            if isinstance(item, dict) and item.get("status") in statuses
        ]
        if not rows:
            continue

        found = True
        print(f"\n## {provider_name} ({provider_slug})")
        for item in rows:
            status = str(item.get("status") or "")
            skill = str(item.get("skill") or "")
            detail = str(item.get("detail") or "")
            print(f"{status:18} {skill:32} {detail}")

    if not found:
        print("No provider-only / broken-link / wrong-target / copy-drift issues found.")

    if args.show_json_path and collected_path is not None:
        print(f"\nJSON: {collected_path}")

    return 1 if found else 0


if __name__ == "__main__":
    raise SystemExit(main())
