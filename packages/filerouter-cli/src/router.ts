import type { FileCommand, ParsedRoute, Router, RouterConfig } from "./types";
import { CommandNotFoundError, RunCommandError } from "./errors";
import { executeCommand, executeWithLayouts, findLayoutChain } from "./context";
import { generateCommandHelp, generateGlobalHelp, hasHelpFlag } from "./help";
import { setCliName } from "./commandInfo";
import { getProjectName } from "./packageJson";

/**
 * Create a commands router
 *
 * @example
 * ```ts
 * import { createCommandsRouter } from "filerouter-cli";
 * import { commandsTree } from "./commandsTree.gen";
 *
 * export const router = createCommandsRouter({
 *   commandsTree,
 *   context: { db: database },
 *   defaultOnError: (error) => console.error(error),
 * });
 *
 * // In main.ts
 * const route = parseRoute(process.argv);
 * await router.run(route);
 * ```
 */
export function createCommandsRouter<TContext extends Record<string, unknown> = Record<string, unknown>>(
  config: RouterConfig<TContext>
): Router<TContext> {
  const {
    commandsTree,
    context = {} as TContext,
    defaultOnError,
    cliName: explicitCliName,
    strictFlags = true,
  } = config;

  // Resolve CLI name: explicit > package.json > fallback
  const cliName = explicitCliName ?? getProjectName();
  
  // Sync with commandInfo() so it uses the same CLI name
  setCliName(cliName);

  /**
   * Get available command paths for error messages
   */
  function getAvailableCommands(): string[] {
    return Object.keys(commandsTree).filter((path) => {
      // Filter out layout-only commands (paths ending with / but not root)
      // and pathless layouts (starting with _)
      const segments = path.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      return !lastSegment?.startsWith("_");
    });
  }

  /**
   * Find a command by path
   */
  function findCommand(path: string): FileCommand<any, any, any, any> | undefined {
    return commandsTree[path];
  }

  /**
   * Execute a command and handle its output
   */
  async function handleRoute(
    route: ParsedRoute,
    printOutput: boolean
  ): Promise<string | number | void> {
    // Check for global help (--help with no command)
    if (route.path === "__help__" || (route.path === "/" && hasHelpFlag(route.args))) {
      const helpText = generateGlobalHelp(commandsTree, cliName);
      if (printOutput) console.log(helpText);
      return helpText;
    }

    const command = findCommand(route.path);

    if (!command) {
      throw new CommandNotFoundError(route.path, getAvailableCommands());
    }

    // Check for command-specific help
    if (hasHelpFlag(route.args)) {
      const helpText = generateCommandHelp(
        command,
        cliName,
        route.path,
        command.config.aliases
      );
      if (printOutput) console.log(helpText);
      return helpText;
    }

    // Find layout chain
    const layouts = findLayoutChain(route.path, commandsTree);

    try {
      // Execute with layouts
      const result = await executeWithLayouts(
        command,
        layouts,
        route,
        context,
        { strictFlags }
      );

      // Handle output
      if (printOutput) {
        if (typeof result === "string") {
          console.log(result);
        } else if (typeof result === "number") {
          process.exit(result);
        }
      }

      return result;
    } catch (error) {
      // Handle runCommand calls (command invoking another command)
      if (error instanceof RunCommandError) {
        const newRoute: ParsedRoute = {
          path: error.path,
          params: {},
          args: error.args ?? {},
          rawArgs: [],
        };
        return handleRoute(newRoute, printOutput);
      }

      // Try error handlers in order: layouts (outermost first) -> command -> global
      // This allows layouts to handle errors from their children
      const errorHandlers = [
        ...layouts.map((l) => l.config.onError),
        command.config.onError,
      ].filter(Boolean);

      for (const onError of errorHandlers) {
        const handled = onError!(error as Error);
        if (handled !== undefined) {
          if (printOutput) {
            console.error(handled);
          }
          return handled;
        }
      }

      // Handle global error handler
      if (defaultOnError) {
        defaultOnError(error as Error);
        return;
      }

      // Re-throw if no error handler
      throw error;
    }
  }

  return {
    /**
     * Run a command (prints output to console)
     */
    async run(route: ParsedRoute): Promise<void> {
      await handleRoute(route, true);
    },

    /**
     * Invoke a command programmatically (returns result without printing)
     */
    async invoke(route: ParsedRoute): Promise<string | number | void> {
      return handleRoute(route, false);
    },
  };
}
