import { afterEach, describe, expect, it, vi } from "vitest";
import { formatInstalls, searchMarket } from "../src/services/market";

describe("market", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed skills from API response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          {
            id: "owner/repo/skill-a",
            skillId: "skill-a",
            name: "Skill A",
            source: "owner/repo",
            installs: 1000,
          },
        ],
        count: 1,
      }),
    });
    const results = await searchMarket("skill");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Skill A");
    expect(results[0].installs).toBe(1000);
  });

  it("returns empty array on API failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    const results = await searchMarket("skill");
    expect(results).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));
    const results = await searchMarket("skill");
    expect(results).toEqual([]);
  });
});

describe("formatInstalls", () => {
  it("formats millions", () => {
    expect(formatInstalls(1_500_000)).toBe("1.5M");
  });
  it("formats thousands", () => {
    expect(formatInstalls(2_300)).toBe("2.3K");
  });
  it("formats small numbers", () => {
    expect(formatInstalls(42)).toBe("42");
  });
});
