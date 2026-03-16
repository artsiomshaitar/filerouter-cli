import type { z } from "zod";
import { ParseError } from "./errors";

// ============================================================================
// String Similarity Utilities
// ============================================================================

const MAX_EDIT_DISTANCE = 3;
const MIN_SIMILARITY = 0.4;

/**
 * Calculate Damerau-Levenshtein distance between two strings.
 * Handles insertions, deletions, substitutions, and transpositions.
 * 
 * Based on Commander.js implementation.
 */
function editDistance(a: string, b: string): number {
  // Quick early exit for very different lengths
  if (Math.abs(a.length - b.length) > MAX_EDIT_DISTANCE) {
    return Math.max(a.length, b.length);
  }

  // Distance matrix between prefix substrings
  const d: number[][] = [];

  // Pure deletions turn 'a' into empty string
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
  }

  // Pure insertions turn empty string into 'b'
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }

  // Fill the matrix
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );

      // Transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[a.length][b.length];
}

/**
 * Information about a valid flag
 */
export interface FlagInfo {
  /** The canonical flag name */
  canonical: string;
  /** Aliases for this flag */
  aliases: string[];
}

/**
 * Extract all valid flag names from a Zod schema and aliases.
 * Returns a Map where keys are all valid flag names (canonical + aliases)
 * and values contain the canonical name and all aliases.
 */
export function extractValidFlags(
  schema: z.ZodTypeAny | undefined,
  aliases?: Record<string, string[]>
): Map<string, FlagInfo> {
  const flagMap = new Map<string, FlagInfo>();

  if (!schema || !("shape" in schema)) {
    return flagMap;
  }

  const zodObject = schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
  const shape = zodObject.shape;

  for (const canonicalName of Object.keys(shape)) {
    const flagAliases = aliases?.[canonicalName] ?? [];
    const info: FlagInfo = {
      canonical: canonicalName,
      aliases: flagAliases,
    };

    // Add canonical name
    flagMap.set(canonicalName, info);

    // Add all aliases pointing to the same info
    for (const alias of flagAliases) {
      flagMap.set(alias, info);
    }
  }

  return flagMap;
}

/**
 * Format a flag with its aliases for display
 */
function formatFlagWithAliases(info: FlagInfo): string {
  const canonical = info.canonical.length === 1 
    ? `-${info.canonical}` 
    : `--${info.canonical}`;
  
  if (info.aliases.length === 0) {
    return canonical;
  }

  const aliasStr = info.aliases
    .map(a => a.length === 1 ? `-${a}` : `--${a}`)
    .join(", ");
  
  return `${canonical} (alias: ${aliasStr})`;
}

/**
 * Find similar flags for an unknown flag using prefix matching and edit distance.
 * 
 * Priority:
 * 1. Prefix matches (unknown is a prefix of a valid flag)
 * 2. Edit distance matches (typos)
 */
export function suggestSimilarFlags(
  unknownFlag: string,
  validFlags: Map<string, FlagInfo>
): { suggestions: FlagInfo[]; allFlags: FlagInfo[] } {
  // Get unique canonical flags (avoid duplicates from aliases)
  const uniqueFlags = new Map<string, FlagInfo>();
  for (const info of validFlags.values()) {
    uniqueFlags.set(info.canonical, info);
  }
  
  const allFlags = Array.from(uniqueFlags.values());
  const suggestions: FlagInfo[] = [];
  const seen = new Set<string>();

  // Normalize the unknown flag (remove leading dashes)
  const normalizedUnknown = unknownFlag.replace(/^-+/, "");

  // 1. Check prefix matches first
  for (const info of allFlags) {
    const canonical = info.canonical;
    
    // Check if unknown is a prefix of canonical
    if (canonical.startsWith(normalizedUnknown) && canonical !== normalizedUnknown) {
      if (!seen.has(canonical)) {
        suggestions.push(info);
        seen.add(canonical);
      }
    }
    
    // Also check if unknown is a prefix of any alias
    for (const alias of info.aliases) {
      if (alias.startsWith(normalizedUnknown) && alias !== normalizedUnknown) {
        if (!seen.has(canonical)) {
          suggestions.push(info);
          seen.add(canonical);
        }
      }
    }
  }

  // 2. Check edit distance for typos (only if no prefix matches)
  if (suggestions.length === 0) {
    let bestDistance = MAX_EDIT_DISTANCE;
    const candidates: { info: FlagInfo; distance: number }[] = [];

    for (const info of allFlags) {
      // Skip single-character flags for distance matching
      if (info.canonical.length <= 1) continue;

      const distance = editDistance(normalizedUnknown, info.canonical);
      const maxLen = Math.max(normalizedUnknown.length, info.canonical.length);
      const similarity = (maxLen - distance) / maxLen;

      if (similarity > MIN_SIMILARITY && distance <= MAX_EDIT_DISTANCE) {
        candidates.push({ info, distance });
        if (distance < bestDistance) {
          bestDistance = distance;
        }
      }
    }

    // Only include candidates with the best distance
    for (const { info, distance } of candidates) {
      if (distance === bestDistance && !seen.has(info.canonical)) {
        suggestions.push(info);
        seen.add(info.canonical);
      }
    }
  }

  // Sort suggestions alphabetically
  suggestions.sort((a, b) => a.canonical.localeCompare(b.canonical));

  return { suggestions, allFlags };
}

/**
 * Format an error message for unknown flags
 */
export function formatUnknownFlagsError(
  unknownFlags: string[],
  validFlags: Map<string, FlagInfo>
): { message: string; help: string } {
  const lines: string[] = [];
  const allSuggestions: FlagInfo[] = [];

  for (const flag of unknownFlags) {
    const displayFlag = flag.startsWith("-") ? flag : `--${flag}`;
    const { suggestions } = suggestSimilarFlags(flag, validFlags);
    
    if (suggestions.length > 0) {
      allSuggestions.push(...suggestions);
    }
    
    lines.push(displayFlag);
  }

  const flagWord = unknownFlags.length === 1 ? "flag" : "flags";
  const message = `Unknown ${flagWord}: ${lines.join(", ")}`;

  let help: string;
  
  // Deduplicate suggestions
  const uniqueSuggestions = Array.from(
    new Map(allSuggestions.map(s => [s.canonical, s])).values()
  );

  if (uniqueSuggestions.length > 0) {
    if (uniqueSuggestions.length === 1) {
      help = `Did you mean: ${formatFlagWithAliases(uniqueSuggestions[0])}?`;
    } else {
      const formatted = uniqueSuggestions.map(formatFlagWithAliases).join(", ");
      help = `Did you mean one of: ${formatted}?`;
    }
  } else {
    // List all available flags
    const uniqueFlags = new Map<string, FlagInfo>();
    for (const info of validFlags.values()) {
      uniqueFlags.set(info.canonical, info);
    }
    const allFlagsList = Array.from(uniqueFlags.values())
      .sort((a, b) => a.canonical.localeCompare(b.canonical))
      .map(formatFlagWithAliases)
      .join(", ");
    
    help = allFlagsList 
      ? `Available flags: ${allFlagsList}`
      : "No flags available for this command.";
  }

  return { message, help };
}

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
        
        // Double dash requires 2+ character flag name
        if (flagName.length === 1) {
          throw new ParseError(
            `Invalid flag format: ${arg}`,
            `Use single dash for single-character flags: -${flagName}`,
            "INVALID_ARG"
          );
        }
        
        const value = arg.slice(equalIndex + 1);
        flags[flagName] = parseValue(value);
      } else {
        // --flag or --flag value
        const flagName = arg.slice(2);
        
        // Double dash requires 2+ character flag name
        if (flagName.length === 1) {
          throw new ParseError(
            `Invalid flag format: --${flagName}`,
            `Use single dash for single-character flags: -${flagName}`,
            "INVALID_ARG"
          );
        }
        
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
 * Options for validateArgs
 */
export interface ValidateArgsOptions {
  /** Whether to reject unknown flags (default: true) */
  strictFlags?: boolean;
}

/**
 * Validate parsed flags against a Zod schema
 */
export function validateArgs<T extends z.ZodTypeAny>(
  flags: Record<string, unknown>,
  schema: T,
  aliases?: Record<string, string[]>,
  options?: ValidateArgsOptions
): z.infer<T> {
  const { strictFlags = true } = options ?? {};

  // Check for unknown flags before expanding aliases
  if (strictFlags) {
    const validFlags = extractValidFlags(schema, aliases);
    const unknownFlags: string[] = [];

    for (const flag of Object.keys(flags)) {
      if (!validFlags.has(flag)) {
        unknownFlags.push(flag);
      }
    }

    if (unknownFlags.length > 0) {
      const { message, help } = formatUnknownFlagsError(unknownFlags, validFlags);
      throw new ParseError(message, help, "UNKNOWN_FLAG");
    }
  }

  // Expand aliases
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
