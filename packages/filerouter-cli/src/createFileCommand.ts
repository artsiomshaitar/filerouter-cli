import type { z } from "zod";
import type { CommandConfig, FileCommand, FileCommandsByPath, ExtractParams, AnyCommand } from "./types";

/**
 * Infer context from parent command in FileCommandsByPath
 * Falls back to object if path not found (before generator runs)
 */
type InferContextFromPath<TPath extends string> = 
  TPath extends keyof FileCommandsByPath
    ? FileCommandsByPath[TPath] extends { parentCommand: infer P }
      ? P extends { __context?: infer C }
        ? C
        : object
      : object
    : object;

/**
 * Creates a file-based command definition.
 *
 * This is a curried function that first takes the route path,
 * then returns a function that takes the command configuration.
 *
 * Path parameters are inferred from the route path:
 * - "/list/$projectId" -> params: { projectId: string }
 * - "/add/$" -> params: { _splat: string[] }
 *
 * Context type is automatically inferred from the parent command chain,
 * which is set up by the generated code via `FileCommandsByPath`.
 *
 * @example
 * ```ts
 * // Simple case with paramsDescription
 * export const Command = createFileCommand("/list/$projectId")({
 *   description: "Get project info",
 *   paramsDescription: { projectId: "The project ID to fetch" },
 *   handler: async ({ params, context }) => {
 *     // context is typed from root command!
 *     return `Project: ${params.projectId}`;
 *   },
 * });
 *
 * // Advanced case with validation
 * export const Command = createFileCommand("/list/$projectId")({
 *   description: "Get project info",
 *   validateParams: z.object({ projectId: z.string().uuid() }),
 *   handler: async ({ params }) => {
 *     return `Project: ${params.projectId}`;
 *   },
 * });
 *
 * // Splat route (captures remaining args)
 * export const Command = createFileCommand("/add/$")({
 *   description: "Add packages",
 *   paramsDescription: { _splat: "Packages to add" },
 *   handler: async ({ params }) => {
 *     return `Adding: ${params._splat.join(", ")}`;
 *   },
 * });
 * ```
 */
export function createFileCommand<TPath extends keyof FileCommandsByPath | (string & {})>(path: TPath) {
  type TContext = InferContextFromPath<TPath extends string ? TPath : never>;
  
  return <
    TArgs extends z.ZodTypeAny = z.ZodObject<Record<string, never>>,
    TParams extends z.ZodTypeAny = z.ZodType<ExtractParams<TPath extends string ? TPath : string>>,
  >(
    config: CommandConfig<TPath extends string ? TPath : string, TArgs, TParams, TContext>
  ): FileCommand<TPath extends string ? TPath : string, TArgs, TParams, TContext> => {
    const command: FileCommand<TPath extends string ? TPath : string, TArgs, TParams, TContext> = {
      __path: path as TPath extends string ? TPath : string,
      config,
      __context: undefined as unknown as TContext,
      __getParentCommand: undefined,
      update<TParentCommand extends AnyCommand>(opts: { id?: string; path?: string; getParentCommand?: () => TParentCommand }) {
        return {
          ...this,
          __getParentCommand: opts.getParentCommand,
        } as FileCommand<TPath extends string ? TPath : string, TArgs, TParams, TContext>;
      },
      _addFileChildren<TChildren>(children: TChildren) {
        return {
          ...this,
          children,
        } as FileCommand<TPath extends string ? TPath : string, TArgs, TParams, TContext> & { children: TChildren };
      },
    };
    return command;
  };
}
