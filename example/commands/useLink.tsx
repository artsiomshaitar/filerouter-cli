import { createFileCommand } from "filerouter-cli";
import { Box, render, Text } from "ink";

// my-cli useLink
// Example showing framework-agnostic nature - you can use any rendering library

export const Command = createFileCommand("/useLink")({
  description: "Demo command showing Ink integration (framework agnostic)",
  handler: async () => {
    // Using Ink for rich terminal UI
    render(
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>
          Hello from Ink!
        </Text>
        <Text>
          This demonstrates that filerouter-cli is <Text color="cyan">framework agnostic</Text>.
        </Text>
        <Text dimColor>You can use Ink, Blessed, or any other terminal UI library.</Text>
      </Box>,
    );
  },
});
