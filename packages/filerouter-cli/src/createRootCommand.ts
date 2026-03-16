import type { Middleware } from "./types";

/**
 * Configuration for the root command
 */
export interface RootCommandConfig<TContext extends object = object> {
  /** Description of the CLI tool */
  description: string;
  /** Version of the CLI tool */
  version?: string;
  /** Global middleware (applied to all commands) */
  middleware?: Middleware<TContext>[];
}

/**
 * Root command instance type
 * Carries the context type for inheritance by child commands
 */
export interface RootCommand<TContext extends object = object> {
  /** @internal Marker for root command */
  readonly __isRoot: true;
  /** @internal Phantom type for context inference */
  readonly __context?: TContext;
  /** Root command configuration */
  readonly config: RootCommandConfig<TContext>;
  /**
   * Update the root command with additional options
   * @internal Used by generated code
   */
  update: (opts: Partial<RootCommandConfig<TContext>>) => RootCommand<TContext>;
  /**
   * Add file-based children to this command
   * @internal Used by generated code
   */
  _addFileChildren: <TChildren>(children: TChildren) => RootCommand<TContext> & { children: TChildren };
}

/**
 * Creates a root command that defines the CLI's context type.
 * 
 * The root command is required and should be placed in `commands/root.ts`.
 * It defines the shared context type that will be available to all command handlers.
 * 
 * @example
 * ```ts
 * // commands/root.ts
 * import { createRootCommand } from "filerouter-cli";
 * 
 * interface AppContext {
 *   db: Database;
 *   config: Config;
 * }
 * 
 * export const RootCommand = createRootCommand<AppContext>()({
 *   description: "My awesome CLI tool",
 *   version: "1.0.0",
 * });
 * ```
 * 
 * @returns A factory function that creates the root command with the specified context type
 */
export function createRootCommand<TContext extends object = object>() {
  return (config: RootCommandConfig<TContext>): RootCommand<TContext> => {
    const rootCommand: RootCommand<TContext> = {
      __isRoot: true,
      __context: undefined as unknown as TContext,
      config,
      update(opts) {
        return {
          ...this,
          config: { ...this.config, ...opts },
        };
      },
      _addFileChildren<TChildren>(children: TChildren) {
        return {
          ...this,
          children,
        } as RootCommand<TContext> & { children: TChildren };
      },
    };
    return rootCommand;
  };
}
