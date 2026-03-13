import type { z } from "zod";
import type { CommandConfig, FileCommand, ExtractParams } from "./types";

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
 * @example
 * ```ts
 * // Simple case with paramsDescription
 * export const Command = createFileCommand("/list/$projectId")({
 *   description: "Get project info",
 *   paramsDescription: { projectId: "The project ID to fetch" },
 *   handler: async ({ params }) => {
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
export function createFileCommand<TPath extends string>(path: TPath) {
  return <
    TArgs extends z.ZodTypeAny = z.ZodObject<Record<string, never>>,
    TParams extends z.ZodTypeAny = z.ZodType<ExtractParams<TPath>>,
    TContext = Record<string, unknown>,
  >(
    config: CommandConfig<TPath, TArgs, TParams, TContext>
  ): FileCommand<TPath, TArgs, TParams, TContext> => {
    return {
      __path: path,
      config,
    } as const;
  };
}
