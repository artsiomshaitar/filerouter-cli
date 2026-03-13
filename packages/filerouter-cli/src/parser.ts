import type { z } from "zod";
import { ParseError } from "./errors";

/**
 * Result of parsing raw arguments
 */
export interface ParsedArgs {
  /** Named arguments (flags) */
  flags: Record<string, unknown>;
  /** Positional arguments */
  positional: string[];
}

/**
 * Options for parsing arguments
 */
export interface ParseOptions {
  /** Set of flag names that are boolean (don't consume next arg) */
  booleanFlags?: Set<string>;
  /** Aliases mapping canonical name to alias names */
  aliases?: Record<string, string[]>;
}

/**
 * Extract boolean flag names from a Zod schema
 * 
 * This inspects the schema to find all fields that are z.boolean()
 * (including wrapped in .optional(), .default(), etc.)
 */
export function extractBooleanFlags(
  schema: z.ZodTypeAny | undefined,
  aliases?: Record<string, string[]>
): Set<string> {
  const booleanFlags = new Set<string>();
  
  if (!schema || !("shape" in schema)) {
    return booleanFlags;
  }

  const zodObject = schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
  const shape = zodObject.shape;

  for (const [name, fieldSchema] of Object.entries(shape)) {
    if (isBooleanSchema(fieldSchema)) {
      booleanFlags.add(name);
      
      // Also add aliases for this flag
      if (aliases?.[name]) {
        for (const alias of aliases[name]) {
          booleanFlags.add(alias);
        }
      }
    }
  }

  return booleanFlags;
}

/**
 * Check if a Zod schema represents a boolean type
 * Handles: z.boolean(), z.boolean().optional(), z.boolean().default(false), etc.
 */
function isBooleanSchema(schema: z.ZodTypeAny): boolean {
  if (!("_def" in schema)) return false;

  const def = schema._def as Record<string, unknown>;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodBoolean":
      return true;
    case "ZodDefault":
    case "ZodOptional":
    case "ZodNullable":
      // Unwrap and check inner type
      const innerType = def.innerType as z.ZodTypeAny | undefined;
      return innerType ? isBooleanSchema(innerType) : false;
    default:
      return false;
  }
}

/**
 * Expand aliases in a flags object
 */
export function expandAliases(
  flags: Record<string, unknown>,
  aliases: Record<string, string[]>
): Record<string, unknown> {
  const expanded: Record<string, unknown> = { ...flags };

  // Create reverse mapping: alias -> canonical name
  const aliasToCanonical: Record<string, string> = {};
  for (const [canonical, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      aliasToCanonical[alias] = canonical;
    }
  }

  // Expand aliases
  for (const [key, value] of Object.entries(flags)) {
    const canonical = aliasToCanonical[key];
    if (canonical && !(canonical in expanded)) {
      expanded[canonical] = value;
      delete expanded[key];
    }
  }

  return expanded;
}

/**
 * Parse raw argv into flags and positional arguments
 *
 * Supports:
 * - --flag value
 * - --flag=value
 * - -f value
 * - -f=value
 * - --boolean (sets to true)
 * - --no-boolean (sets to false)
 * - Positional arguments (everything that doesn't start with -)
 * 
 * When booleanFlags is provided, those flags will never consume the next argument.
 * This allows patterns like: `cli add -D package` where -D is boolean.
 */
export function parseRawArgs(argv: string[], options: ParseOptions = {}): ParsedArgs {
  const { booleanFlags = new Set<string>() } = options;
  const flags: Record<string, unknown> = {};
  const positional: string[] = [];

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      // Everything after -- is positional
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith("--no-")) {
      // --no-flag sets flag to false
      const flagName = arg.slice(5);
      flags[flagName] = false;
      i++;
      continue;
    }

    if (arg.startsWith("--")) {
      const equalIndex = arg.indexOf("=");
      if (equalIndex !== -1) {
        // --flag=value (explicit value syntax always takes value)
        const flagName = arg.slice(2, equalIndex);
        const value = arg.slice(equalIndex + 1);
        flags[flagName] = parseValue(value);
      } else {
        // --flag or --flag value
        const flagName = arg.slice(2);
        const nextArg = argv[i + 1];

        // Check if this flag is known to be boolean
        const isBoolean = booleanFlags.has(flagName);

        if (isBoolean || nextArg === undefined || nextArg.startsWith("-")) {
          // Boolean flag - don't consume next arg
          flags[flagName] = true;
        } else {
          // --flag value
          flags[flagName] = parseValue(nextArg);
          i++;
        }
      }
      i++;
      continue;
    }

    if (arg.startsWith("-") && arg.length > 1) {
      const equalIndex = arg.indexOf("=");
      if (equalIndex !== -1) {
        // -f=value (explicit value syntax always takes value)
        const flagName = arg.slice(1, equalIndex);
        const value = arg.slice(equalIndex + 1);
        flags[flagName] = parseValue(value);
      } else {
        // -f or -f value
        const flagName = arg.slice(1);
        const nextArg = argv[i + 1];

        // Check if this flag is known to be boolean
        const isBoolean = booleanFlags.has(flagName);

        if (isBoolean || nextArg === undefined || nextArg.startsWith("-")) {
          // Boolean flag - don't consume next arg
          flags[flagName] = true;
        } else {
          // -f value
          flags[flagName] = parseValue(nextArg);
          i++;
        }
      }
      i++;
      continue;
    }

    // Positional argument
    positional.push(arg);
    i++;
  }

  return { flags, positional };
}

/**
 * Parse a string value into appropriate type
 */
function parseValue(value: string): unknown {
  // Boolean
  if (value === "true") return true;
  if (value === "false") return false;

  // Number
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") {
    return num;
  }

  // String
  return value;
}

/**
 * Validate parsed flags against a Zod schema
 */
export function validateArgs<T extends z.ZodTypeAny>(
  flags: Record<string, unknown>,
  schema: T,
  aliases?: Record<string, string[]>
): z.infer<T> {
  // Expand aliases first
  const expandedFlags = aliases ? expandAliases(flags, aliases) : flags;

  const result = schema.safeParse(expandedFlags);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  --${e.path.join(".")}: ${e.message}`)
      .join("\n");

    throw new ParseError(
      `Invalid arguments:\n${errors}`,
      "Check the argument types and try again.",
      "VALIDATION_ERROR"
    );
  }

  return result.data;
}

/**
 * Validate path parameters against a Zod schema
 */
export function validateParams<T extends z.ZodTypeAny>(
  params: Record<string, string | string[]>,
  schema: T
): z.infer<T> {
  const result = schema.safeParse(params);

  if (!result.success) {
    const errors = result.error.errors
      .map((e) => `  ${e.path.join(".")}: ${e.message}`)
      .join("\n");

    throw new ParseError(
      `Invalid parameters:\n${errors}`,
      "Check the parameter values and try again.",
      "VALIDATION_ERROR"
    );
  }

  return result.data;
}
