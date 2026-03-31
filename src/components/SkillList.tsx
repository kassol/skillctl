import React from "react";
import { Box, Text } from "ink";
import type { LocalSkill, MarketSkill } from "../types.js";
import { isEnabled } from "../types.js";
import { formatInstalls } from "../services/market.js";

interface SkillListProps {
  skills: LocalSkill[];
  marketResults: MarketSkill[];
  isMarketMode: boolean;
  selectedIndex: number;
  focused: boolean;
  searchQuery: string;
  marketOnline: boolean;
}

export function SkillList({ skills, marketResults, isMarketMode, selectedIndex, focused, searchQuery, marketOnline }: SkillListProps) {
  const borderColor = focused ? "blue" : "gray";

  if (isMarketMode) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
        <Box paddingX={1}>
          <Text bold color={focused ? "blue" : "white"}>Market</Text>
          {searchQuery ? <Text color="gray"> "{searchQuery}"</Text> : null}
        </Box>
        {!marketOnline && (
          <Box paddingX={1}><Text color="red">offline</Text></Box>
        )}
        {marketResults.length === 0 && marketOnline && (
          <Box paddingX={1}>
            <Text color="gray">{searchQuery ? "No results" : "Press / to search"}</Text>
          </Box>
        )}
        {marketResults.map((skill, i) => {
          const isSelected = i === selectedIndex;
          return (
            <Box key={skill.id} paddingX={1}>
              <Text color={isSelected ? "blue" : "white"} bold={isSelected}>
                {isSelected ? "▶" : " "} {skill.name}
              </Text>
              <Text color="cyan"> {formatInstalls(skill.installs)}</Text>
            </Box>
          );
        })}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
      <Box paddingX={1}>
        <Text bold color={focused ? "blue" : "white"}>Skills</Text>
      </Box>
      {skills.map((skill, i) => {
        const isSelected = i === selectedIndex;
        const enabled = isEnabled(skill);
        const statusIcon = !skill.managed ? "⚠" : enabled ? "●" : "○";
        const statusColor = !skill.managed ? "yellow" : enabled ? "green" : "gray";
        return (
          <Box key={skill.name} paddingX={1}>
            <Text color={statusColor}>{statusIcon}</Text>
            <Text color={isSelected ? "blue" : skill.managed ? "white" : "gray"} bold={isSelected} dimColor={!skill.managed}>
              {isSelected ? " ▶" : "  "} {skill.name}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
