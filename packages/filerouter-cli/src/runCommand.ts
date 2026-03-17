import { RunCommandError } from "./errors";
import { extractRouteParams } from "./parseRoute";

/**
 * Declaration merging interface — extended by generated commandsTree.gen.ts
 * to provide type-safe command paths, args, and params.
 */
export interface Register {}

export type RegisteredRouter = Register extends { router: infer R } ? R : any;

export type RegisteredContext = RegisteredRouter extends { __context?: infer C } ? C : object;

export type RegisteredCommandPath = Register extends {
  commandPath: infer TPath;
}
  ? TPath
  : string;

export type RegisteredCommandArgs = Register extends {
  commandArgs: infer TArgs;
}
  ? TArgs
  : Record<string, Record<string, unknown>>;

// Using {} instead of Record<string, never> because Record<string, never>
// matches any string key (evaluating to `never`), which breaks conditional types.
export type RegisteredCommandParams = Register extends {
  commandParams: infer TParams;
}
  ? TParams
  : // biome-ignore lint/complexity/noBannedTypes: intentional - see comment above
    {};

function resolvePath(path: string, params?: Record<string, string | string[]>): string {
  if (!params) return path;

  const segments = path.split("/");
  const resolvedSegments: string[] = [];

  for (const segment of segments) {
    if (segment.startsWith("$")) {
      const paramName = segment.slice(1);

      if (paramName === "") {
        const splatValue = params._splat;
        if (Array.isArray(splatValue)) {
          resolvedSegments.push(...splatValue);
        } else if (splatValue) {
          resolvedSegments.push(splatValue);
        }
      } else {
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

function validateParams(path: string, params?: Record<string, string | string[]>): void {
  const requiredParams = extractRouteParams(path);

  if (requiredParams.length === 0) {
    return;
  }

  if (!params) {
    throw new Error(`runCommand to "${path}" requires params: ${requiredParams.join(", ")}`);
  }

  for (const paramName of requiredParams) {
    if (!(paramName in params)) {
      throw new Error(`runCommand to "${path}" is missing required param: ${paramName}`);
    }

    const value = params[paramName];
    if (paramName === "_splat") {
      if (!Array.isArray(value)) {
        throw new Error(`runCommand to "${path}": _splat param must be an array`);
      }
    } else {
      if (typeof value !== "string") {
        throw new Error(`runCommand to "${path}": param "${paramName}" must be a string`);
      }
    }
  }
}

export type EmptyParams = { readonly __empty?: never };

export type ParamsForPath<TPath extends RegisteredCommandPath> =
  TPath extends keyof RegisteredCommandParams ? RegisteredCommandParams[TPath] : EmptyParams;

export type ArgsForPath<TPath extends RegisteredCommandPath> =
  TPath extends keyof RegisteredCommandArgs
    ? RegisteredCommandArgs[TPath]
    : Record<string, unknown>;

type IsEmptyParams<TParams> = TParams extends EmptyParams ? true : false;

export type RunCommandOptionsWithParams<TPath extends RegisteredCommandPath> = {
  params: ParamsForPath<TPath>;
  args?: ArgsForPath<TPath>;
};

export type RunCommandOptionsWithoutParams<TPath extends RegisteredCommandPath> = {
  params?: never;
  args?: ArgsForPath<TPath>;
};

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
  const argsValue = (options as Record<string, unknown>)?.args as
    | Record<string, unknown>
    | undefined;

  validateParams(path, params);
  const resolvedPath = resolvePath(path, params);

  throw new RunCommandError(resolvedPath, argsValue);
}
