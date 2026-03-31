import { Box, Text } from "ink";

export function Header() {
  return (
    <Box paddingX={1}>
      <Text bold>skills-tui</Text>
      <Text color="gray"> v0.1.0</Text>
    </Box>
  );
}
