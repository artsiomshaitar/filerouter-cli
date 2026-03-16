import type {
  FileCommand,
  HandlerContext,
  ParsedRoute,
} from "./types";
import { getShell } from "./shell";
import { validateArgs, validateParams, type ValidateArgsOptions } from "./parser";
import { executeMiddleware } from "./middleware";

/**
 * Options for command execution
 */
export interface ExecuteCommandOptions {
  /** Whether to reject unknown flags (default: true) */
  strictFlags?: boolean;
}

/**
 * Execute a command with all its middleware and handler
 */
export async function executeCommand<TContext extends object>(
  command: FileCommand<any, any, any, any>,
  route: ParsedRoute,
  userContext: TContext,
  outlet?: Promise<string | number | void>,
  options?: ExecuteCommandOptions
): Promise<string | number | void> {
  const { config } = command;
  const { strictFlags = true } = options ?? {};

  // Validate and parse args
  let validatedArgs = route.args;
  if (config.validateArgs) {
    validatedArgs = validateArgs(
      route.args as Record<string, unknown>,
      config.validateArgs,
      config.aliases,
      { strictFlags }
    );
  }

  // Validate and parse params
  let validatedParams = route.params;
  if (config.validateParams) {
    validatedParams = validateParams(route.params, config.validateParams);
  }

  // Build handler context
  const handlerContext: HandlerContext = {
    args: validatedArgs,
    params: validatedParams,
    context: userContext,
    $: getShell(),
    outlet,
    rawArgs: route.rawArgs,
  };

  let result: string | number | void = undefined;

  // Execute middleware chain, then handler
  const middleware = config.middleware ?? [];

  await executeMiddleware(
    middleware,
    userContext,
    async () => {
      result = await config.handler(handlerContext);
    }
  );

  return result;
}

/**
 * Find layout commands for a given path
 *
 * For path /_auth/protected, returns:
 * - /_auth (if it exists and has a handler)
 *
 * Layout commands are identified by:
 * - Being a pathless layout (path segment starts with _)
 * - Having a route.ts file in that _ directory
 */
export function findLayoutChain(
  path: string,
  commandsTree: Record<string, FileCommand<any, any, any, any>>
): FileCommand<any, any, any, any>[] {
  const layouts: FileCommand<any, any, any, any>[] = [];
  const segments = path.split("/").filter(Boolean);

  // Build parent paths and check for layouts
  // Only pathless layouts (segments starting with _) are considered
  let currentPath = "";
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Only include if this is a pathless layout (starts with _)
    if (segment.startsWith("_")) {
      const layoutCommand = commandsTree[currentPath];
      if (layoutCommand) {
        layouts.push(layoutCommand);
      }
    }
  }

  return layouts;
}

/**
 * Execute a command with its layout chain
 *
 * Layouts wrap the child command output via the `outlet` property.
 * Execution order: outermost layout -> innermost layout -> command
 */
export async function executeWithLayouts<TContext extends object>(
  command: FileCommand<any, any, any, any>,
  layouts: FileCommand<any, any, any, any>[],
  route: ParsedRoute,
  userContext: TContext,
  options?: ExecuteCommandOptions
): Promise<string | number | void> {
  if (layouts.length === 0) {
    // No layouts, just execute the command
    return executeCommand(command, route, userContext, undefined, options);
  }

  // Build the execution chain from innermost to outermost
  // The innermost is the actual command, wrapped by each layout

  // Start with the actual command as the innermost outlet
  let currentOutlet: Promise<string | number | void> = executeCommand(
    command,
    route,
    userContext,
    undefined,
    options
  );

  // Wrap with layouts from innermost to outermost
  for (let i = layouts.length - 1; i >= 0; i--) {
    const layout = layouts[i];
    const outlet = currentOutlet;

    currentOutlet = executeCommand(layout, route, userContext, outlet, options);
  }

  return currentOutlet;
}
