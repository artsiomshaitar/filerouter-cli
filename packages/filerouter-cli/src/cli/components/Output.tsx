import { Box, Text } from "ink";

export type OutputEntryType = "command" | "result" | "error" | "info" | "watch";

export interface OutputEntry {
  id: number;
  type: OutputEntryType;
  content: string;
  timestamp: Date;
}

export interface OutputProps {
  entries: OutputEntry[];
  maxEntries?: number;
}

export function Output({ entries, maxEntries = 100 }: OutputProps) {
  // Show only the last N entries
  const visibleEntries = entries.slice(-maxEntries);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {visibleEntries.map((entry) => (
        <OutputLine key={entry.id} entry={entry} />
      ))}
    </Box>
  );
}

function OutputLine({ entry }: { entry: OutputEntry }) {
  switch (entry.type) {
    case "command":
      return (
        <Box>
          <Text dimColor>&gt; </Text>
          <Text>{entry.content}</Text>
        </Box>
      );

    case "result":
      // Handle multi-line results
      return (
        <Box flexDirection="column">
          {entry.content.split("\n").map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, order never changes
            <Text key={`${entry.id}-result-${i}`}>{line}</Text>
          ))}
        </Box>
      );

    case "error":
      return (
        <Box flexDirection="column">
          {entry.content.split("\n").map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static content, order never changes
            <Text key={`${entry.id}-error-${i}`} color="red">
              {line}
            </Text>
          ))}
        </Box>
      );

    case "info":
      return (
        <Box>
          <Text color="blue">{entry.content}</Text>
        </Box>
      );

    case "watch":
      return (
        <Box>
          <Text color="yellow">[watch] </Text>
          <Text>{entry.content}</Text>
        </Box>
      );

    default:
      return <Text>{entry.content}</Text>;
  }
}
