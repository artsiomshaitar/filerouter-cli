import { createRootCommand } from "filerouter-cli";

/**
 * Application context type
 * This is available to all command handlers via the `context` parameter
 */
export interface AppContext {
  logger: {
    info: (message: string) => void;
    debug: (message: string) => void;
  };
}

/**
 * Root command - defines the CLI's context type and metadata
 */
export const RootCommand = createRootCommand<AppContext>()({
  description: "Example CLI tool demonstrating filerouter-cli",
});
