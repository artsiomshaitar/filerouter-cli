import { createCommandsRouter, ParseError } from "filerouter-cli";
import { commandsTree, parseRoute } from "./commandsTree.gen";

// Check if verbose mode is enabled
const isVerbose = () => true;

/**
 * Create the router instance
 * Context type is inferred from RootCommand in commands/root.ts
 */
export const router = createCommandsRouter({
  commandsTree,
  context: {
    logger: {
      info: (message: string) => console.log(message),
      debug: (message: string) => {
        if (isVerbose()) {
          console.log(`[debug] ${message}`);
        }
      },
    },
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
