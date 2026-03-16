import type { z } from "zod";

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
export type Middleware<TContext = Record<string, unknown>> = (
  context: TContext,
  next: () => Promise<void>
) => Promise<void>;

/**
 * Handler context - what gets passed to each command handler
 */
export interface HandlerContext<
  TArgs = Record<string, unknown>,
  TParams = Record<string, unknown>,
  TContext = Record<string, unknown>,
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
  TContext = Record<string, unknown>,
> = (ctx: HandlerContext<TArgs, TParams, TContext>) => Promise<string | number | void>;

/**
 * Command configuration
 */
export interface CommandConfig<
  TPath extends string = string,
  TArgs extends z.ZodTypeAny = z.ZodObject<Record<string, never>>,
  TParams extends z.ZodTypeAny = z.ZodObject<Record<string, never>>,
  TContext = Record<string, unknown>,
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
 * Command definition (what gets exported from each command file)
 */
export interface FileCommand<
  TPath extends string = string,
  TArgs extends z.ZodTypeAny = z.ZodTypeAny,
  TParams extends z.ZodTypeAny = z.ZodTypeAny,
  TContext = Record<string, unknown>,
> {
  /** The route path for this command */
  readonly __path: TPath;
  /** The command configuration */
  readonly config: CommandConfig<TPath, TArgs, TParams, TContext>;
}

/**
 * Router configuration
 */
export interface RouterConfig<TContext = Record<string, unknown>> {
  /** The commands tree (auto-generated) */
  commandsTree: Record<string, FileCommand<any, any, any, any>>;
  /** Shared context available to all commands */
  context?: TContext;
  /** Global error handler */
  defaultOnError?: (error: Error) => void;
  /** CLI name for help output (default: "cli") */
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
 * Command info helper return type
 */
export interface CommandInfo {
  /** Command description */
  description: string;
  /** Generate usage string */
  usage: () => string;
}

/**
 * Router instance type
 */
export interface Router<TContext = Record<string, unknown>> {
  /** Run a command (prints output, handles errors) */
  run: (route: ParsedRoute) => Promise<void>;
  /** Invoke a command programmatically (returns result, doesn't print) */
  invoke: (route: ParsedRoute) => Promise<string | number | void>;
}
