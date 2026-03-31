import React from "react";
import { Box, Text } from "ink";

interface StatusBarProps {
  message: string;
}

export function StatusBar({ message }: StatusBarProps) {
  return (
    <Box paddingX={1} borderStyle="single" borderTop borderColor="gray">
      <Text color="gray">
        Tab:switch  /:search  a:add  d/e:toggle  D/E:all  x:delete  u:update  q:quit
      </Text>
      {message ? (
        <>
          <Text color="gray"> | </Text>
          <Text color="yellow">{message}</Text>
        </>
      ) : null}
    </Box>
  );
}
