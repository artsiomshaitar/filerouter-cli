import type { z } from "zod";

/**
 * Type helper to extract alias types from an alias map
 *
 * Given: { full: ["f", "fl"] }
 * Returns: { full: ..., f: ..., fl: ... }
 */
export type WithAliases<
  TShape extends Record<string, z.ZodTypeAny>,
  TAliases extends Record<keyof TShape, string[]>,
> = TShape & {
  [K in TAliases[keyof TAliases][number]]: TShape[Extract<
    keyof TShape,
    { [P in keyof TAliases]: K extends TAliases[P][number] ? P : never }[keyof TAliases]
  >];
};

/**
 * Create a Zod schema with alias support
 *
 * This is a helper that doesn't modify the schema itself,
 * but provides type information for the alias mapping.
 *
 * The actual alias expansion happens at parse time in the parser.
 *
 * @example
 * ```ts
 * const { schema, aliases } = withAliases(
 *   z.object({
 *     full: z.boolean().default(false),
 *     output: z.string().optional(),
 *   }),
 *   {
 *     full: ["f"],
 *     output: ["o", "out"],
 *   }
 * );
 *
 * // Use in command:
 * export const Command = createFileCommand("/list")({
 *   validateArgs: schema,
 *   aliases,
 *   handler: async ({ args }) => {
 *     // args.full is typed
 *   },
 * });
 * ```
 */
export function withAliases<
  TShape extends Record<string, z.ZodTypeAny>,
  TAliases extends Partial<Record<keyof TShape, string[]>>,
>(
  schema: z.ZodObject<TShape>,
  aliases: TAliases
): {
  schema: z.ZodObject<TShape>;
  aliases: TAliases;
} {
  return {
    schema,
    aliases,
  };
}

/**
 * Reverse alias map: from alias to canonical name
 *
 * Given: { full: ["f", "fl"] }
 * Returns: { f: "full", fl: "full" }
 */
export function reverseAliases(
  aliases: Record<string, string[]>
): Record<string, string> {
  const reversed: Record<string, string> = {};

  for (const [canonical, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      reversed[alias] = canonical;
    }
  }

  return reversed;
}
