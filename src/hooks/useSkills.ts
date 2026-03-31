import { createStore } from "zustand/vanilla";
import type { Config, MarketSkill, Repo } from "../types.js";

export interface SkillsState {
  repos: Repo[];
  marketResults: MarketSkill[];
  config: Config | null;
  selectedRepo: number;
  selectedSkill: number;
  selectedAgent: number;
  focusedColumn: number;
  isMarketMode: boolean;
  loading: boolean;
  searchQuery: string;
  searchActive: boolean;
  overlayMode: "search" | "add-repo";
  confirmAction: { type: string; message: string; onConfirm: () => void } | null;
  statusMessage: string;

  setRepos: (repos: Repo[]) => void;
  setMarketResults: (results: MarketSkill[]) => void;
  setConfig: (config: Config) => void;
  selectRepo: (index: number) => void;
  selectSkill: (index: number) => void;
  selectAgent: (index: number) => void;
  focusNext: () => void;
  focusPrev: () => void;
  setMarketMode: (on: boolean) => void;
  setLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchActive: (active: boolean) => void;
  setOverlayMode: (mode: "search" | "add-repo") => void;
  setConfirmAction: (action: SkillsState["confirmAction"]) => void;
  setStatusMessage: (msg: string) => void;
}

export function createSkillsStore() {
  return createStore<SkillsState>((set) => ({
    repos: [],
    marketResults: [],
    config: null,
    selectedRepo: 0,
    selectedSkill: 0,
    selectedAgent: 0,
    focusedColumn: 0,
    isMarketMode: false,
    loading: true,
    searchQuery: "",
    searchActive: false,
    overlayMode: "search" as const,
    confirmAction: null,
    statusMessage: "",

    setRepos: (repos) => set({ repos, loading: false }),
    setMarketResults: (marketResults) => set({ marketResults }),
    setConfig: (config) => set({ config }),
    selectRepo: (index) => set({ selectedRepo: index, selectedSkill: 0, selectedAgent: 0 }),
    selectSkill: (index) => set({ selectedSkill: index, selectedAgent: 0 }),
    selectAgent: (index) => set({ selectedAgent: index }),
    focusNext: () => set((s) => ({ focusedColumn: (s.focusedColumn + 1) % 3 })),
    focusPrev: () => set((s) => ({ focusedColumn: (s.focusedColumn + 2) % 3 })),
    setMarketMode: (isMarketMode) => set({ isMarketMode, selectedSkill: 0 }),
    setLoading: (loading) => set({ loading }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSearchActive: (searchActive) => set({ searchActive }),
    setOverlayMode: (overlayMode) => set({ overlayMode }),
    setConfirmAction: (confirmAction) => set({ confirmAction }),
    setStatusMessage: (statusMessage) => set({ statusMessage }),
  }));
}
