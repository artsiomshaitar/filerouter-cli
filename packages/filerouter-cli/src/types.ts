import type { z } from "zod";
import type { RootCommand } from "./createRootCommand";

/**
 * File commands by path - extended by generated code for type-safe context inference
 * 
 * This interface is populated by the generated `commandsTree.gen.ts` file via
 * declaration merging. It maps each command path to its metadata including
 * the parent command type, which enables automatic context type inference.
 * 
 * @example
 * ```ts
 * // Generated in commandsTree.gen.ts:
 * declare module 'filerouter-cli' {
 *   interface FileCommandsByPath {
 *     '/': {
 *       id: '/';
 *       path: '/';
 *       fullPath: '/';
 *       parentCommand: typeof RootCommand;
 *     };
 *     '/list': {
 *       id: '/list';
 *       path: '/list';
 *       fullPath: '/list';
 *       parentCommand: typeof RootCommand;
 *     };
 *   }
 * }
 * ```
 */
export interface FileCommandsByPath {
  // Extended by generated code
}

/**
 * Any command type (root or file command)
 */
export type AnyCommand = RootCommand<any> | FileCommand<any, any, any, any>;

/**
 * Extract param names from a route path string
 * 
 * Examples:
 * - "/list/$projectId" -> "projectId"
 * - "/users/$userId/posts/$postId" -> "userId" | "postId"
 * - "/add/$" -> "_splat"
 */
type ExtractParamNames<T extends string> = 
  T extends `${string}/$${infer Param}/${infer Rest}`
    ? (Param extends "" ? "_splat" : Param) | ExtractParamNames<`/${Rest}`>
    : T extends `${string}/$${infer Param}`
      ? Param extends "" ? "_splat" : Param
      : never;

/**
 * Build params object type from route path
 * 
 * Examples:
 * - ExtractParams<"/list/$projectId"> = { projectId: string }
 * - ExtractParams<"/add/$"> = { _splat: string[] }
 * - ExtractParams<"/users/$userId/posts/$postId"> = { userId: string; postId: string }
 */
export type ExtractParams<T extends string> = [ExtractParamNames<T>] extends [never]
  ? Record<string, never>
  : {
      [K in ExtractParamNames<T>]: K extends "_splat" ? string[] : string;
    };

/**
 * Shell execution function type (compatible with Bun.$)
 */
export type ShellFn = typeof Bun.$;

/**
 * Middleware function type
 * Receives context and a next function to call the next middleware
 */
export type Middleware<TContext = object> = (
  context: TContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Handler context - what gets passed to each command handler
 */
export interface HandlerContext<
  TArgs = Record<string, unknown>,
  TParams = Record<string, unknown>,
  TContext = object,
> {
  /** Parsed and validated arguments (flags) */
  args: TArgs;
  /** Parsed and validated path parameters */
  params: TParams;
  /** User-provided shared context */
  context: TContext;
  /** Shell execution (Bun.$) */
  $: ShellFn;
  /** For layout commands - the child command's output (Promise) */
  outlet?: Promise<string | number | void>;
  /** Raw argv for advanced use */
  rawArgs: string[];
}

/**
 * Command handler function type
 */
export type CommandHandler<
  TArgs = Record<string, unknown>,
  TParams = Record<string, unknown>,
  TContext = object,
> = (ctx: HandlerContext<TArgs, TParams, TContext>) => Promise<string | number | void>;

/**
 * Command configuration
 */
export interface CommandConfig<
  TPath extends string = string,
  TArgs extends z.ZodTypeAny = z.ZodObject<Record<string, never>>,
  TParams extends z.ZodTypeAny = z.ZodObject<Record<string, never>>,
  TContext = object,
> {
  /** Description shown in help text */
  description: string;
  /** Zod schema for validating arguments (flags like --name, -f) */
  validateArgs?: TArgs;
  /** Zod schema for validating path parameters ($projectId) */
  validateParams?: TParams;
  /** 
   * Simple descriptions for path parameters (type-inferred from route path)
   * Use this for simple cases; use validateParams with .describe() for advanced validation
   */
  paramsDescription?: Partial<Record<keyof ExtractParams<TPath>, string>>;
  /** Alias mappings for arguments: { full: ["f", "fl"] } */
  aliases?: Record<string, string[]>;
  /** Middleware functions to run before the handler */
  middleware?: Middleware<TContext>[];
  /** Error handler for this command */
  onError?: (error: Error) => string | void;
  /** The command handler function */
  handler: CommandHandler<z.infer<TArgs>, z.infer<TParams>, TContext>;
}

/**
 * Update options for a file command (used by generated code)
 */
export interface FileCommandUpdateOptions<TParentCommand extends AnyCommand = AnyCommand> {
  /** Command ID (usually same as path) */
  id?: string;
  /** Command path segment */
  path?: string;
  /** Function that returns the parent command */
  getParentCommand?: () => TParentCommand;
}

/**
 * Command definition (what gets exported from each command file)
 */
export interface FileCommand<
  TPath extends string = string,
  TArgs extends z.ZodTypeAny = z.ZodTypeAny,
  TParams extends z.ZodTypeAny = z.ZodTypeAny,
  TContext = object,
> {
  /** The route path for this command */
  readonly __path: TPath;
  /** The command configuration */
  readonly config: CommandConfig<TPath, TArgs, TParams, TContext>;
  /** @internal Phantom type for context inference */
  readonly __context?: TContext;
  /** @internal Parent command getter (set by generated code) */
  readonly __getParentCommand?: () => AnyCommand;
  /**
   * Update the command with additional options (id, path, parent)
   * @internal Used by generated code to wire up parent relationships
   */
  update: <TParentCommand extends AnyCommand>(
    opts: FileCommandUpdateOptions<TParentCommand>
  ) => FileCommand<TPath, TArgs, TParams, TContext>;
  /**
   * Add file-based children to this command
   * @internal Used by generated code for nested commands
   */
  _addFileChildren: <TChildren>(
    children: TChildren
  ) => FileCommand<TPath, TArgs, TParams, TContext> & { children: TChildren };
}

/**
 * Router configuration
 */
export interface RouterConfig<TContext = object> {
  /** The commands tree (auto-generated) */
  commandsTree: Record<string, FileCommand<any, any, any, any>>;
  /** Parse argv into a route (auto-generated) */
  parseRoute: (argv: string[]) => ParsedRoute;
  /** Shared context available to all commands */
  context?: TContext;
  /** Global error handler */
  defaultOnError?: (error: Error) => void;
  /** 
   * CLI name for help output.
   * If not provided, automatically reads from package.json "name" field.
   * Falls back to "cli" if package.json cannot be found.
   */
  cliName?: string;
  /** Whether to reject unknown flags (default: true) */
  strictFlags?: boolean;
}

/**
 * Parsed route (output of parseRoute)
 */
export interface ParsedRoute {
  /** The matched command path */
  path: string;
  /** Extracted path parameters (string for regular params, string[] for _splat) */
  params: Record<string, string | string[]>;
  /** Parsed arguments */
  args: Record<string, unknown>;
  /** Raw argv after command matching */
  rawArgs: string[];
}

/**
 * Information about a Zod schema field (used in command args)
 */
export interface FieldInfo {
  /** Field name */
  name: string;
  /** Field type (string, number, boolean, array, or enum values) */
  type: string;
  /** Field description from Zod .describe() */
  description?: string;
  /** Whether the field is optional */
  isOptional: boolean;
  /** Default value if defined */
  defaultValue?: unknown;
}

/**
 * Information about a path parameter
 */
export interface ParamInfo {
  /** Parameter name (e.g., "projectId" or "_splat") */
  name: string;
  /** Parameter description */
  description?: string;
  /** Whether this is a splat/variadic parameter */
  isSplat: boolean;
}

/**
 * Command info helper return type
 */
export interface CommandInfo {
  /** Command description */
  description: string;
  /** Get just the CLI command without args (e.g., "my-cli auth") */
  command(): string;
  /** Get usage string with args (e.g., "my-cli auth --username <string> --password <string>") */
  usage(): string;
  /** Extracted arg field information */
  args: FieldInfo[];
  /** Extracted param information */
  params: ParamInfo[];
  /** Get full help text (like --help output) */
  fullUsage(): string;
}

/**
 * Router instance type
 */
export interface Router<TContext = object> {
  /** Run a command from argv (prints output, handles errors, exits on error) */
  run: (argv: string[]) => Promise<void>;
  /** Invoke a command programmatically (returns result, doesn't print) */
  invoke: (route: ParsedRoute) => Promise<string | number | void>;
  /** @internal Type-only property for context inference */
  readonly __context?: TContext;
}
