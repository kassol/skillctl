import { Box, useStdout } from "ink";
import type { LocalSkill, MarketSkill, Repo } from "../types.js";
import { DetailPanel } from "./DetailPanel.js";
import { RepoList } from "./RepoList.js";
import { SkillList } from "./SkillList.js";

interface MillerColumnsProps {
  repos: Repo[];
  currentSkills: LocalSkill[];
  marketResults: MarketSkill[];
  isMarketMode: boolean;
  selectedRepo: number;
  selectedSkill: number;
  selectedAgent: number;
  focusedColumn: number;
  searchQuery: string;
  marketOnline: boolean;
}

export function MillerColumns({
  repos,
  currentSkills,
  marketResults,
  isMarketMode,
  selectedRepo,
  selectedSkill,
  selectedAgent,
  focusedColumn,
  searchQuery,
  marketOnline,
}: MillerColumnsProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;

  const currentSkill = currentSkills[selectedSkill] ?? null;
  const currentMarketSkill = marketResults[selectedSkill] ?? null;

  // Below 50: only show focused column
  if (cols < 50) {
    if (focusedColumn === 0) {
      return (
        <Box flexGrow={1}>
          <RepoList
            repos={repos}
            selectedIndex={selectedRepo}
            focused
            isMarketMode={isMarketMode}
          />
        </Box>
      );
    }
    if (focusedColumn === 1) {
      return (
        <Box flexGrow={1}>
          <SkillList
            skills={currentSkills}
            marketResults={marketResults}
            isMarketMode={isMarketMode}
            selectedIndex={selectedSkill}
            focused
            searchQuery={searchQuery}
            marketOnline={marketOnline}
          />
        </Box>
      );
    }
    return (
      <Box flexGrow={1}>
        <DetailPanel
          skill={currentSkill}
          marketSkill={currentMarketSkill}
          isMarketMode={isMarketMode}
          focused
          selectedAgent={selectedAgent}
        />
      </Box>
    );
  }

  // Below 100: hide detail panel
  if (cols < 100) {
    return (
      <Box flexGrow={1}>
        <RepoList
          repos={repos}
          selectedIndex={selectedRepo}
          focused={focusedColumn === 0}
          isMarketMode={isMarketMode}
        />
        <SkillList
          skills={currentSkills}
          marketResults={marketResults}
          isMarketMode={isMarketMode}
          selectedIndex={selectedSkill}
          focused={focusedColumn === 1}
          searchQuery={searchQuery}
          marketOnline={marketOnline}
        />
      </Box>
    );
  }

  // Full three-column layout
  return (
    <Box flexGrow={1}>
      <RepoList
        repos={repos}
        selectedIndex={selectedRepo}
        focused={focusedColumn === 0}
        isMarketMode={isMarketMode}
      />
      <SkillList
        skills={currentSkills}
        marketResults={marketResults}
        isMarketMode={isMarketMode}
        selectedIndex={selectedSkill}
        focused={focusedColumn === 1}
        searchQuery={searchQuery}
        marketOnline={marketOnline}
      />
      <DetailPanel
        skill={currentSkill}
        marketSkill={currentMarketSkill}
        isMarketMode={isMarketMode}
        focused={focusedColumn === 2}
        selectedAgent={selectedAgent}
      />
    </Box>
  );
}
