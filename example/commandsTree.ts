import { createCommandsRouter } from "filerouter-cli";
import { commandsTree, parseRoute } from "./commandsTree.gen";

// Check if verbose mode is enabled
const isVerbose = () => true;

/**
 * Create the router instance
 * Context type is inferred from RootCommand in commands/root.ts
 */
export const router = createCommandsRouter({
  commandsTree,
  parseRoute,
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
});
