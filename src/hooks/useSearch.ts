import { useEffect, useRef, useState } from "react";
import { searchMarket } from "../services/market.js";
import type { MarketSkill } from "../types.js";

export function useMarketSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<MarketSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!enabled || !query || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await searchMarket(query);
      setResults(res);
      setLoading(false);
    }, 150);
    return () => clearTimeout(timerRef.current);
  }, [query, enabled]);

  return { results, loading };
}

export function filterLocal<T extends { name: string }>(items: T[], query: string): T[] {
  if (!query) return items;
  const lower = query.toLowerCase();
  return items.filter((item) => item.name.toLowerCase().includes(lower));
}
