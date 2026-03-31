import { Box, Text, useInput } from "ink";

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  useInput((input, key) => {
    if (input === "y" || key.return) onConfirm();
    else if (input === "n" || key.escape) onCancel();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
      width={50}
    >
      <Text bold color="yellow">
        Confirm
      </Text>
      <Text>{message}</Text>
      <Text color="gray" dimColor>
        y/Enter: confirm n/Esc: cancel
      </Text>
    </Box>
  );
}
