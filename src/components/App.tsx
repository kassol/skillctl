import { homedir } from "node:os";
import { join } from "node:path";
import { Box, Text } from "ink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAgentInfos } from "../agents.js";
import { useFocus } from "../hooks/useFocus.js";
import { filterLocal, useMarketSearch } from "../hooks/useSearch.js";
import { createSkillsStore, type SkillsState } from "../hooks/useSkills.js";
import { readConfig } from "../services/config.js";
import { checkMarketOnline } from "../services/market.js";
import {
  parseLockFile,
  readLockFile,
  resolveAgentBindings,
  scanInstalledSkills,
} from "../services/scanner.js";
import type { LocalSkill, Repo } from "../types.js";
import { CANONICAL_ROOT } from "../types.js";
import { ConfirmDialog } from "./ConfirmDialog.js";
import { Header } from "./Header.js";
import { MillerColumns } from "./MillerColumns.js";
import { SearchOverlay } from "./SearchOverlay.js";
import { StatusBar } from "./StatusBar.js";

function useStore(store: ReturnType<typeof createSkillsStore>): SkillsState {
  const [state, setState] = useState(store.getState());
  useEffect(() => {
    const unsub = store.subscribe(setState);
    return unsub;
  }, [store]);
  return state;
}

export function App() {
  const storeRef = useRef(createSkillsStore());
  const state = useStore(storeRef.current);
  const [marketOnline, setMarketOnline] = useState(true);
  const [searchInput, setSearchInput] = useState("");

  const loadData = useCallback(async () => {
    try {
      const config = await readConfig();
      storeRef.current.getState().setConfig(config);

      const lockPath = join(homedir(), ".agents", ".skill-lock.json");
      const lockData = await readLockFile(lockPath);
      const lockGroups = parseLockFile(lockData);

      const skillToSource: Record<string, string> = {};
      for (const [source, skills] of lockGroups) {
        for (const skill of skills) skillToSource[skill] = source;
      }

      const scannedSkills = await scanInstalledSkills(CANONICAL_ROOT, skillToSource);
      const agentInfos = getAgentInfos();

      const fullSkills = await Promise.all(
        scannedSkills.map(async (s) => ({
          ...s,
          agents: await resolveAgentBindings(s.name, agentInfos, CANONICAL_ROOT),
        })),
      );

      const repoMap = new Map<string, LocalSkill[]>();
      for (const skill of fullSkills) {
        const list = repoMap.get(skill.repo) ?? [];
        list.push(skill as LocalSkill);
        repoMap.set(skill.repo, list);
      }

      const repos: Repo[] = [...repoMap.entries()].map(([source, skills]) => ({
        source,
        url: `https://github.com/${source}`,
        skills,
        skillCount: skills.length,
      }));

      storeRef.current.getState().setRepos(repos);
    } catch (err) {
      storeRef.current
        .getState()
        .setStatusMessage(`Load error: ${err instanceof Error ? err.message : String(err)}`);
      storeRef.current.getState().setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    checkMarketOnline().then(setMarketOnline);
  }, [loadData]);

  // Filtered repos for display — must be computed before currentSkills
  const filteredRepos = useMemo(() => {
    return filterLocal(
      state.repos.map((r) => ({ ...r, name: r.source })),
      state.isMarketMode ? "" : state.searchQuery,
    ).map(({ name: _, ...r }) => r) as Repo[];
  }, [state.repos, state.searchQuery, state.isMarketMode]);

  // Derive current skills from selected repo in FILTERED list
  const currentSkills = useMemo(() => {
    if (state.isMarketMode) return [];
    const repo = filteredRepos[state.selectedRepo];
    if (!repo) return [];
    return repo.skills;
  }, [filteredRepos, state.selectedRepo, state.isMarketMode]);

  // Market search
  const { results: marketResults } = useMarketSearch(state.searchQuery, state.isMarketMode);

  useEffect(() => {
    if (state.isMarketMode) {
      storeRef.current.getState().setMarketResults(marketResults);
    }
  }, [marketResults, state.isMarketMode]);

  // Keyboard handler — disabled when search overlay or confirm dialog is active
  useFocus({
    state,
    currentSkills,
    repoCount: filteredRepos.length,
    marketResultCount: state.marketResults.length,
    onReload: loadData,
    disabled: state.searchActive || state.confirmAction !== null,
    defaultAgents: state.config?.defaultAgents ?? ["claude-code"],
  });

  // Search overlay handlers
  const handleSearchSubmit = useCallback(
    async (value: string) => {
      const s = storeRef.current.getState();
      // If in repo add mode (focusedColumn === 0 and not market), treat as add repo
      if (s.focusedColumn === 0 && !s.isMarketMode && /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(value)) {
        s.setSearchActive(false);
        setSearchInput("");
        s.setStatusMessage(`Adding ${value}...`);
        try {
          const { addRepo: addRepoCmd } = await import("../services/repo.js");
          const { addRepo: addRepoConfig } = await import("../services/config.js");
          await addRepoCmd(value, s.config?.defaultAgents ?? ["claude-code"]);
          await addRepoConfig(value);
          s.setStatusMessage(`Added ${value}`);
          await loadData();
        } catch (err) {
          s.setStatusMessage(`Add failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return;
      }
      // Normal search
      s.setSearchQuery(value);
      s.setSearchActive(false);
      setSearchInput("");
    },
    [loadData],
  );

  const handleSearchCancel = useCallback(() => {
    storeRef.current.getState().setSearchActive(false);
    setSearchInput("");
  }, []);

  if (state.loading) {
    return (
      <Box flexDirection="column" width="100%">
        <Header />
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <Text color="gray">Scanning skills...</Text>
        </Box>
        <StatusBar message="" />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width="100%">
      <Header />
      <MillerColumns
        repos={filteredRepos}
        currentSkills={currentSkills}
        marketResults={state.marketResults}
        isMarketMode={state.isMarketMode}
        selectedRepo={state.selectedRepo}
        selectedSkill={state.selectedSkill}
        selectedAgent={state.selectedAgent}
        focusedColumn={state.focusedColumn}
        searchQuery={state.searchQuery}
        marketOnline={marketOnline}
      />
      {state.searchActive && (
        <SearchOverlay
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={handleSearchSubmit}
          onCancel={handleSearchCancel}
        />
      )}
      {state.confirmAction && (
        <ConfirmDialog
          message={state.confirmAction.message}
          onConfirm={state.confirmAction.onConfirm}
          onCancel={() => storeRef.current.getState().setConfirmAction(null)}
        />
      )}
      <StatusBar message={state.statusMessage} />
    </Box>
  );
}
