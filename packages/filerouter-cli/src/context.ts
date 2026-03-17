import { executeMiddleware } from "./middleware";
import { validateArgs, validateParams } from "./parser";
import { getShell } from "./shell";
import type { FileCommand, HandlerContext, ParsedRoute } from "./types";

export interface ExecuteCommandOptions {
  /** Whether to reject unknown flags (default: true) */
  strictFlags?: boolean;
}

export async function executeCommand<TContext extends object>(
  command: FileCommand<any, any, any, any>,
  route: ParsedRoute,
  userContext: TContext,
  outlet?: Promise<string | number | void>,
  options?: ExecuteCommandOptions,
): Promise<string | number | void> {
  const { config } = command;
  const { strictFlags = true } = options ?? {};

  let validatedArgs = route.args;
  if (config.validateArgs) {
    validatedArgs = validateArgs(
      route.args as Record<string, unknown>,
      config.validateArgs,
      config.aliases,
      { strictFlags },
    );
  }

  let validatedParams = route.params;
  if (config.validateParams) {
    validatedParams = validateParams(route.params, config.validateParams);
  }

  const handlerContext: HandlerContext = {
    args: validatedArgs,
    params: validatedParams,
    context: userContext,
    $: getShell(),
    outlet,
    rawArgs: route.rawArgs,
  };

  // biome-ignore lint/complexity/noUselessUndefinedInitialization: required for TS2454
  let result: string | number | void = undefined;

  const middleware = config.middleware ?? [];

  await executeMiddleware(middleware, userContext, async () => {
    result = await config.handler(handlerContext);
  });

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
  commandsTree: Record<string, FileCommand<any, any, any, any>>,
): FileCommand<any, any, any, any>[] {
  const layouts: FileCommand<any, any, any, any>[] = [];
  const segments = path.split("/").filter(Boolean);

  let currentPath = "";
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

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
  options?: ExecuteCommandOptions,
): Promise<string | number | void> {
  if (layouts.length === 0) {
    return executeCommand(command, route, userContext, undefined, options);
  }

  let currentOutlet: Promise<string | number | void> = executeCommand(
    command,
    route,
    userContext,
    undefined,
    options,
  );

  for (let i = layouts.length - 1; i >= 0; i--) {
    const layout = layouts[i];
    const outlet = currentOutlet;

    currentOutlet = executeCommand(layout, route, userContext, outlet, options);
  }

  return currentOutlet;
}
