import React from "react";
import { Box, Text } from "ink";
import type { Repo } from "../types.js";

interface RepoListProps {
  repos: Repo[];
  selectedIndex: number;
  focused: boolean;
  isMarketMode: boolean;
}

export function RepoList({ repos, selectedIndex, focused, isMarketMode }: RepoListProps) {
  const borderColor = focused ? "blue" : "gray";

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="30%">
      <Box paddingX={1}>
        <Text bold color={focused ? "blue" : "white"}>Repos</Text>
      </Box>
      {repos.map((repo, i) => {
        const isSelected = !isMarketMode && i === selectedIndex;
        const prefix = isSelected ? "▶" : " ";
        const shortName = repo.source.length > 18 ? repo.source.slice(0, 17) + "…" : repo.source;
        return (
          <Box key={repo.source} paddingX={1}>
            <Text color={isSelected ? "blue" : "white"} bold={isSelected}>
              {prefix} {shortName}
            </Text>
            <Text color="gray"> ({repo.skillCount})</Text>
          </Box>
        );
      })}
      <Box paddingX={1} marginTop={1}>
        <Text color={isMarketMode ? "green" : "gray"} bold={isMarketMode}>
          {isMarketMode ? "▶" : "▷"} Market
        </Text>
      </Box>
    </Box>
  );
}
