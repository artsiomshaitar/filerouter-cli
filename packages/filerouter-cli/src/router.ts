import { setCliName } from "./commandInfo";
import { executeWithLayouts, findLayoutChain } from "./context";
import { CommandNotFoundError, ParseError, RunCommandError, toError } from "./errors";
import { generateCommandHelp, generateGlobalHelp, hasHelpFlag } from "./help";
import { getProjectName } from "./packageJson";
import type { FileCommand, ParsedRoute, Router, RouterConfig } from "./types";

/**
 * Create a commands router
 *
 * @example
 * ```ts
 * import { createCommandsRouter } from "filerouter-cli";
 * import { commandsTree, parseRoute } from "./commandsTree.gen";
 *
 * const router = createCommandsRouter({
 *   commandsTree,
 *   parseRoute,
 * });
 *
 * await router.run(process.argv).catch(() => process.exit(1));
 * ```
 */
export function createCommandsRouter<TContext extends object = object>(
  config: RouterConfig<TContext>,
): Router<TContext> {
  const {
    commandsTree,
    parseRoute,
    context = {} as TContext,
    defaultOnError,
    cliName: explicitCliName,
    strictFlags = true,
  } = config;

  const cliName = explicitCliName ?? getProjectName();
  setCliName(cliName);

  function getAvailableCommands(): string[] {
    return Object.keys(commandsTree).filter((path) => {
      // Filter out layout-only commands (paths ending with / but not root)
      // and pathless layouts (starting with _)
      const segments = path.split("/").filter(Boolean);
      const lastSegment = segments[segments.length - 1];
      return !lastSegment?.startsWith("_");
    });
  }

  function findCommand(path: string): FileCommand<any, any, any, any> | undefined {
    return commandsTree[path];
  }

  const MAX_REDIRECT_DEPTH = 10;

  /**
   * Execute a command and handle its output.
   *
   * @param visitedPaths Tracks paths seen during runCommand redirects to detect cycles.
   * @param depth Current redirect depth (0 = initial call).
   */
  async function handleRoute(
    route: ParsedRoute,
    printOutput: boolean,
    visitedPaths: Set<string> = new Set(),
    depth: number = 0,
  ): Promise<string | number | void> {
    if (route.path === "__help__" || (route.path === "/" && hasHelpFlag(route.args))) {
      const helpText = generateGlobalHelp(commandsTree, cliName);
      if (printOutput) console.log(helpText);
      return helpText;
    }

    const command = findCommand(route.path);

    if (!command) {
      throw new CommandNotFoundError(route.path, getAvailableCommands());
    }

    if (hasHelpFlag(route.args)) {
      const helpText = generateCommandHelp(command, cliName, route.path, command.config.aliases);
      if (printOutput) console.log(helpText);
      return helpText;
    }

    const layouts = findLayoutChain(route.path, commandsTree);

    try {
      const result = await executeWithLayouts(command, layouts, route, context, { strictFlags });

      if (printOutput && typeof result === "string") {
        console.log(result);
      }

      return result;
    } catch (error) {
      if (error instanceof RunCommandError) {
        const targetPath = error.path;

        if (visitedPaths.has(targetPath)) {
          throw new Error(
            `runCommand cycle detected: "${targetPath}" was already visited. ` +
              `Chain: ${[...visitedPaths, targetPath].join(" -> ")}`,
          );
        }

        if (depth >= MAX_REDIRECT_DEPTH) {
          throw new Error(
            `runCommand redirect depth exceeded (max ${MAX_REDIRECT_DEPTH}). ` +
              `Chain: ${[...visitedPaths, targetPath].join(" -> ")}`,
          );
        }

        const nextVisited = new Set(visitedPaths);
        nextVisited.add(route.path);

        const newRoute: ParsedRoute = {
          path: targetPath,
          params: {},
          args: error.args ?? {},
          rawArgs: [],
        };
        return handleRoute(newRoute, printOutput, nextVisited, depth + 1);
      }

      // Error handlers: layouts (outermost first) -> command -> global
      const errorHandlers = [
        ...layouts.map((l) => l.config.onError),
        command.config.onError,
      ].filter(Boolean);

      for (const onError of errorHandlers) {
        const handled = onError!(toError(error));
        if (handled !== undefined) {
          if (printOutput) {
            console.error(handled);
          }
          return handled;
        }
      }

      if (defaultOnError) {
        defaultOnError(toError(error));
        return;
      }

      throw error;
    }
  }

  return {
    async run(argv: string[]): Promise<void> {
      try {
        const route = parseRoute(argv);
        await handleRoute(route, true);
      } catch (error) {
        if (error instanceof ParseError || error instanceof CommandNotFoundError) {
          console.error(`Error: ${error.message}`);
          console.log(`\n${error.help}`);
        } else {
          console.error("Unexpected error:", error);
        }
        throw error;
      }
    },

    async invoke(route: ParsedRoute): Promise<string | number | void> {
      return handleRoute(route, false);
    },
  };
}
