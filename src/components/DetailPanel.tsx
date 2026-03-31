import React from "react";
import { Box, Text } from "ink";
import type { LocalSkill, MarketSkill } from "../types.js";
import { isEnabled } from "../types.js";
import { formatInstalls } from "../services/market.js";

interface DetailPanelProps {
  skill: LocalSkill | null;
  marketSkill: MarketSkill | null;
  isMarketMode: boolean;
  focused: boolean;
  selectedAgent: number;
}

export function DetailPanel({ skill, marketSkill, isMarketMode, focused, selectedAgent }: DetailPanelProps) {
  const borderColor = focused ? "blue" : "gray";

  if (isMarketMode && marketSkill) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
        <Box paddingX={1}><Text bold color={focused ? "blue" : "white"}>Detail</Text></Box>
        <Box flexDirection="column" paddingX={1}>
          <Text bold>{marketSkill.name}</Text>
          <Text color="gray">Source: {marketSkill.source}</Text>
          <Text color="cyan">Installs: {formatInstalls(marketSkill.installs)}</Text>
          <Box marginTop={1}><Text color="green">Press Enter to install</Text></Box>
        </Box>
      </Box>
    );
  }

  if (!skill) {
    return (
      <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
        <Box paddingX={1}><Text bold color={focused ? "blue" : "white"}>Detail</Text></Box>
        <Box paddingX={1}><Text color="gray">Select a skill</Text></Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={borderColor} width="35%">
      <Box paddingX={1}><Text bold color={focused ? "blue" : "white"}>Detail</Text></Box>
      <Box flexDirection="column" paddingX={1}>
        <Text bold>{skill.name}</Text>
        {!skill.managed && <Text color="yellow">[manual]</Text>}
        <Text color="gray">Source: {skill.repo}</Text>
        <Text color="gray">Path: {skill.canonicalPath}</Text>
        <Text>Enabled: {isEnabled(skill) ? <Text color="green">✔</Text> : <Text color="red">✘</Text>}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text bold>Agents:</Text>
          {skill.agents.map((binding, i) => {
            const isHighlighted = focused && i === selectedAgent;
            const icon = binding.linked ? "✔" : "☐";
            const color = binding.linked ? "green" : "gray";
            return (
              <Box key={binding.agent} paddingLeft={1}>
                <Text color={isHighlighted ? "blue" : color} bold={isHighlighted} inverse={isHighlighted}>
                  {icon} {binding.agent}
                </Text>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
