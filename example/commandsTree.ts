import { createCommandsRouter, ParseError } from "filerouter-cli";
import { commandsTree, parseRoute } from "./commandsTree.gen";

/**
 * Create the router instance
 */
export const router = createCommandsRouter({
  commandsTree,
  cliName: "my-cli",
  context: {
    // Add any shared context here
    // e.g., database connection, config, etc.
  },
  defaultOnError: (error) => {
    console.error("Error:", error.message);
    // Show help text for parse errors (including unknown flags)
    if (error instanceof ParseError && error.help) {
      console.log(`\n${error.help}`);
    }
  },
});

// Re-export parseRoute from the generated file
export { parseRoute };
