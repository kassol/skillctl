import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface SearchOverlayProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function SearchOverlay({ value, onChange, onSubmit, onCancel }: SearchOverlayProps) {
  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="blue"
      paddingX={1}
      paddingY={0}
      width={50}
    >
      <Text bold color="blue">
        Search
      </Text>
      <Box>
        <Text color="blue">{"> "}</Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="type to search..."
        />
      </Box>
      <Text color="gray" dimColor>
        Enter: submit Esc: cancel
      </Text>
    </Box>
  );
}
