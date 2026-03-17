import { Box, Text } from "ink";

export interface HeaderProps {
  version: string;
  commandsDirectory: string;
  commandCount: number;
}

export function Header({ version, commandsDirectory, commandCount }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          FileRouter CLI
        </Text>
        <Text dimColor> v{version}</Text>
      </Box>
      <Box>
        <Text dimColor>
          Watching: {commandsDirectory} ({commandCount} commands)
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
