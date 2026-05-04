#!/usr/bin/env python3

from __future__ import annotations

import argparse
from pathlib import Path


TEMPLATE = """class Skillctl < Formula
  desc "Control plane for user-level global AI agent skills"
  homepage "https://github.com/kassol/skillctl"
  version "{version}"
  license "MIT"
  depends_on "node"

  if Hardware::CPU.arm?
    url "{arm_url}"
    sha256 "{arm_sha}"
  else
    url "{x64_url}"
    sha256 "{x64_sha}"
  end

  def install
    bin.install "skillctl"
  end

  test do
    output = shell_output("#{{bin}}/skillctl --version")
    assert_match "skillctl", output
  end
end
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Render Homebrew formula for skillctl")
    parser.add_argument("--version", required=True)
    parser.add_argument("--arm-url", required=True)
    parser.add_argument("--arm-sha", required=True)
    parser.add_argument("--x64-url", required=True)
    parser.add_argument("--x64-sha", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    content = TEMPLATE.format(
        version=args.version,
        arm_url=args.arm_url,
        arm_sha=args.arm_sha,
        x64_url=args.x64_url,
        x64_sha=args.x64_sha,
    )
    Path(args.output).write_text(content)


if __name__ == "__main__":
    main()
