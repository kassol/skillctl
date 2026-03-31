import React from "react";
import { Box, Text } from "ink";
import { Header } from "./Header.js";
import { StatusBar } from "./StatusBar.js";

export function App() {
  return (
    <Box flexDirection="column" width="100%">
      <Header />
      <Box flexGrow={1}>
        <Text color="gray">Loading...</Text>
      </Box>
      <StatusBar message="" />
    </Box>
  );
}
