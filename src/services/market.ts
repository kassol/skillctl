import type { MarketSkill } from "../types.js";

const API_BASE = "https://skills.sh";

export type MarketSearchResult = MarketSkill;

export async function searchMarket(query: string, limit = 20): Promise<MarketSearchResult[]> {
  try {
    const url = `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      skills: Array<{
        id: string;
        skillId: string;
        name: string;
        source: string;
        installs: number;
      }>;
    };
    return data.skills.map((s) => ({
      id: s.id,
      skillId: s.skillId,
      name: s.name,
      source: s.source,
      installs: s.installs,
    }));
  } catch {
    return [];
  }
}

export function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

export async function checkMarketOnline(): Promise<boolean> {
  try {
    const res = await fetch("https://skills.sh/api/search?q=test&limit=1");
    return res.ok;
  } catch {
    return false;
  }
}
