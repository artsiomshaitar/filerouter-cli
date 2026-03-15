import { RunCommandError } from "./errors";

/**
 * Register interface for declaration merging
 * The generated commandsTree.gen.ts will extend this with actual types
 */
export interface Register {
  // Will be extended by generated code:
  // commandPath: "/path1" | "/path2" | ...
  // commandArgs: { "/path1": {...}, "/path2": {...}, ... }
  // commandParams: { "/path1": {...}, "/path2": {...}, ... }
}

/**
 * Get registered command path type, or fallback to string
 */
export type RegisteredCommandPath = Register extends {
  commandPath: infer TPath;
}
  ? TPath
  : string;

/**
 * Get registered command args map, or fallback to generic record
 */
export type RegisteredCommandArgs = Register extends {
  commandArgs: infer TArgs;
}
  ? TArgs
  : Record<string, Record<string, unknown>>;

/**
 * Get registered command params map, or fallback to empty object
 * Using {} instead of Record<string, never> because Record<string, never>
 * matches any string key (evaluating to `never`), which causes issues
 * with the conditional type checks.
 */
export type RegisteredCommandParams = Register extends {
  commandParams: infer TParams;
}
  ? TParams
  : {};

/**
 * Extract param names from a path (e.g., "/list/$projectId" -> ["projectId"])
 */
function extractParamNames(path: string): string[] {
  const params: string[] = [];
  const segments = path.split("/");

  for (const segment of segments) {
    if (segment.startsWith("$")) {
      const paramName = segment.slice(1);
      if (paramName === "") {
        params.push("_splat");
      } else {
        params.push(paramName);
      }
    }
  }

  return params;
}

/**
 * Resolve a path with params (e.g., "/list/$projectId" + { projectId: "123" } -> "/list/123")
 */
function resolvePath(
  path: string,
  params?: Record<string, string | string[]>
): string {
  if (!params) return path;

  const segments = path.split("/");
  const resolvedSegments: string[] = [];

  for (const segment of segments) {
    if (segment.startsWith("$")) {
      const paramName = segment.slice(1);

      if (paramName === "") {
        // Splat route - _splat should be an array
        const splatValue = params._splat;
        if (Array.isArray(splatValue)) {
          resolvedSegments.push(...splatValue);
        } else if (splatValue) {
          resolvedSegments.push(splatValue);
        }
      } else {
        // Regular param
        const value = params[paramName];
        if (typeof value === "string") {
          resolvedSegments.push(value);
        } else if (Array.isArray(value)) {
          resolvedSegments.push(value.join("/"));
        }
      }
    } else {
      resolvedSegments.push(segment);
    }
  }

  return resolvedSegments.join("/") || "/";
}

/**
 * Validate that all required params are provided
 */
function validateParams(
  path: string,
  params?: Record<string, string | string[]>
): void {
  const requiredParams = extractParamNames(path);

  if (requiredParams.length === 0) {
    return;
  }

  if (!params) {
    throw new Error(
      `runCommand to "${path}" requires params: ${requiredParams.join(", ")}`
    );
  }

  for (const paramName of requiredParams) {
    if (!(paramName in params)) {
      throw new Error(
        `runCommand to "${path}" is missing required param: ${paramName}`
      );
    }

    const value = params[paramName];
    if (paramName === "_splat") {
      if (!Array.isArray(value)) {
        throw new Error(
          `runCommand to "${path}": _splat param must be an array`
        );
      }
    } else {
      if (typeof value !== "string") {
        throw new Error(
          `runCommand to "${path}": param "${paramName}" must be a string`
        );
      }
    }
  }
}

/**
 * Empty params type - signifies no params are required
 */
export type EmptyParams = { readonly __empty?: never };

/**
 * Get params type for a path.
 * - If path is in the registered params map, use those params
 * - Otherwise (fallback or unknown path), return EmptyParams (no params required)
 */
export type ParamsForPath<TPath extends RegisteredCommandPath> =
  TPath extends keyof RegisteredCommandParams
    ? RegisteredCommandParams[TPath]
    : EmptyParams;

/**
 * Get args type for a path
 */
export type ArgsForPath<TPath extends RegisteredCommandPath> =
  TPath extends keyof RegisteredCommandArgs
    ? RegisteredCommandArgs[TPath]
    : Record<string, unknown>;

/**
 * Check if params is empty (no required params)
 * We check if the type is assignable to EmptyParams
 */
type IsEmptyParams<TParams> = TParams extends EmptyParams ? true : false;

/**
 * Options for runCommand when params are required
 */
export type RunCommandOptionsWithParams<TPath extends RegisteredCommandPath> = {
  params: ParamsForPath<TPath>;
  args?: ArgsForPath<TPath>;
};

/**
 * Options for runCommand when params are not required
 */
export type RunCommandOptionsWithoutParams<TPath extends RegisteredCommandPath> =
  {
    params?: never;
    args?: ArgsForPath<TPath>;
  };

/**
 * Build the rest args type for runCommand based on whether path requires params
 * - If path has no params: options is optional [options?]
 * - If path has params: options is required [options]
 */
type RunCommandArgs<TPath extends RegisteredCommandPath> =
  IsEmptyParams<ParamsForPath<TPath>> extends true
    ? [options?: RunCommandOptionsWithoutParams<TPath>]
    : [options: RunCommandOptionsWithParams<TPath>];

/**
 * Type-safe function to run another command
 *
 * Throws a RunCommandError that the router catches to execute another command.
 *
 * @example
 * ```ts
 * import { runCommand } from "filerouter-cli";
 *
 * // Simple command
 * runCommand("/list");
 *
 * // Command with params
 * runCommand("/list/$projectId", { params: { projectId: "123" } });
 *
 * // Command with args
 * runCommand("/list", { args: { verbose: true } });
 * ```
 */
export function runCommand<TPath extends RegisteredCommandPath>(
  path: TPath,
  ...args: RunCommandArgs<TPath>
): never {
  const options = args[0];
  const params = (options as Record<string, unknown>)?.params as
    | Record<string, string | string[]>
    | undefined;
  const argsValue = (options as Record<string, unknown>)?.args as Record<string, unknown> | undefined;

  // Validate params at runtime
  validateParams(path, params);

  // Resolve the path with params
  const resolvedPath = resolvePath(path, params);

  throw new RunCommandError(resolvedPath, argsValue);
}

/**
 * Check if a value is a RunCommandError
 */
export function isRunCommand(value: unknown): value is RunCommandError {
  return value instanceof RunCommandError;
}
