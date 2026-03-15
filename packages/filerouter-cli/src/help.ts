import type { z } from "zod";
import type { FileCommand } from "./types";

/**
 * Information about a Zod schema field
 */
interface FieldInfo {
  name: string;
  type: string;
  description?: string;
  isOptional: boolean;
  defaultValue?: unknown;
}

/**
 * Extract field information from a Zod object schema
 */
export function extractFieldsFromZodSchema(
  schema: z.ZodTypeAny | undefined
): FieldInfo[] {
  if (!schema) return [];

  // Check if it's a ZodObject
  if (!("shape" in schema)) return [];

  const zodObject = schema as z.ZodObject<Record<string, z.ZodTypeAny>>;
  const shape = zodObject.shape;
  const fields: FieldInfo[] = [];

  for (const [name, fieldSchema] of Object.entries(shape)) {
    const info = extractFieldInfo(name, fieldSchema);
    fields.push(info);
  }

  return fields;
}

/**
 * Extract info from a single Zod field
 */
function extractFieldInfo(name: string, schema: z.ZodTypeAny): FieldInfo {
  let currentSchema = schema;
  let isOptional = false;
  let defaultValue: unknown = undefined;
  let description: string | undefined;

  // Unwrap ZodDefault
  if ("_def" in currentSchema) {
    const def = currentSchema._def as Record<string, unknown>;

    // Check for default
    if (def.typeName === "ZodDefault") {
      // defaultValue is a function that returns the actual default
      const defaultFn = def.defaultValue as (() => unknown) | unknown;
      defaultValue = typeof defaultFn === "function" ? defaultFn() : defaultFn;
      currentSchema = def.innerType as z.ZodTypeAny;
    }

    // Check for optional
    if (def.typeName === "ZodOptional") {
      isOptional = true;
      currentSchema = def.innerType as z.ZodTypeAny;
    }

    // Get description
    if (typeof def.description === "string") {
      description = def.description;
    }
  }

  // Check if optional (also check isOptional method)
  if (typeof schema.isOptional === "function" && schema.isOptional()) {
    isOptional = true;
  }

  // Get type name
  const type = getZodTypeName(currentSchema);

  // Try to get description from the current schema too
  if (!description && "_def" in currentSchema) {
    const def = currentSchema._def as Record<string, unknown>;
    if (typeof def.description === "string") {
      description = def.description;
    }
  }

  return {
    name,
    type,
    description,
    isOptional: isOptional || defaultValue !== undefined,
    defaultValue,
  };
}

/**
 * Get a human-readable type name from a Zod schema
 */
function getZodTypeName(schema: z.ZodTypeAny): string {
  if (!("_def" in schema)) return "unknown";

  const def = schema._def as Record<string, unknown>;
  const typeName = def.typeName as string;

  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return "array";
    case "ZodEnum":
      const values = (def.values as string[]) || [];
      return values.join(" | ");
    case "ZodDefault":
      return getZodTypeName(def.innerType as z.ZodTypeAny);
    case "ZodOptional":
      return getZodTypeName(def.innerType as z.ZodTypeAny);
    default:
      return "value";
  }
}

/**
 * Get param description from various sources (priority order):
 * 1. validateParams schema .describe()
 * 2. paramsDescription object
 * 3. undefined (will use param name in help)
 */
function getParamDescription(
  paramName: string,
  validateParams?: z.ZodTypeAny,
  paramsDescription?: Record<string, string>
): string | undefined {
  // First, try validateParams schema description
  if (validateParams && "shape" in validateParams) {
    const shape = (validateParams as z.ZodObject<Record<string, z.ZodTypeAny>>).shape;
    const fieldSchema = shape[paramName];
    if (fieldSchema) {
      const info = extractFieldInfo(paramName, fieldSchema);
      if (info.description) {
        return info.description;
      }
    }
  }

  // Fall back to paramsDescription
  if (paramsDescription && paramsDescription[paramName]) {
    return paramsDescription[paramName];
  }

  return undefined;
}

/**
 * Generate help text for a specific command
 */
export function generateCommandHelp(
  command: FileCommand<any, any, any, any>,
  cliName: string,
  routePath: string,
  aliases?: Record<string, string[]>
): string {
  const lines: string[] = [];
  const config = command.config;

  // Build usage string
  const usageParts = [cliName];
  const segments = routePath.split("/").filter(Boolean);
  const paramNames: string[] = [];
  let isSplat = false;

  for (const segment of segments) {
    if (segment === "$") {
      // Splat route - show as <items...>
      usageParts.push("<items...>");
      paramNames.push("_splat");
      isSplat = true;
    } else if (segment.startsWith("$")) {
      const paramName = segment.slice(1);
      usageParts.push(`<${paramName}>`);
      paramNames.push(paramName);
    } else if (!segment.startsWith("_")) {
      usageParts.push(segment);
    }
  }

  // Header
  lines.push(`${usageParts.join(" ")} - ${config.description}`);
  lines.push("");

  // Usage - for splat, show items as optional
  if (isSplat) {
    const usageWithOptional = usageParts.map((p) => 
      p === "<items...>" ? "[items...]" : p
    );
    lines.push(`Usage: ${usageWithOptional.join(" ")} [options]`);
  } else {
    lines.push(`Usage: ${usageParts.join(" ")} [options]`);
  }
  lines.push("");

  // Arguments (from params)
  if (paramNames.length > 0) {
    lines.push("Arguments:");
    for (const paramName of paramNames) {
      const desc = getParamDescription(
        paramName,
        config.validateParams,
        config.paramsDescription as Record<string, string> | undefined
      );
      
      // For splat, it's always optional (can be empty array)
      const isSplatParam = paramName === "_splat";
      const displayName = isSplatParam ? "items" : paramName;
      const required = isSplatParam ? "(optional, variadic)" : "(required)";
      
      lines.push(`  ${displayName.padEnd(16)} ${desc || ""} ${required}`);
    }
    lines.push("");
  }

  // Options (from args)
  const argsFields = extractFieldsFromZodSchema(config.validateArgs);
  const commandAliases = config.aliases || {};

  lines.push("Options:");

  for (const field of argsFields) {
    const aliasStr = commandAliases[field.name]
      ? `, -${commandAliases[field.name].join(", -")}`
      : "";
    const flagName = `--${field.name}${aliasStr}`;

    let desc = field.description || "";
    if (field.defaultValue !== undefined) {
      desc += ` (default: ${JSON.stringify(field.defaultValue)})`;
    } else if (field.isOptional) {
      desc += " (optional)";
    }

    // Format with type hint for non-boolean
    const typeHint = field.type === "boolean" ? "" : ` <${field.type}>`;
    lines.push(`  ${(flagName + typeHint).padEnd(24)} ${desc}`);
  }

  // Always add --help
  lines.push(`  ${"--help, -h".padEnd(24)} Show this help message`);

  return lines.join("\n");
}

/**
 * Generate global help text showing all available commands
 */
export function generateGlobalHelp(
  commandsTree: Record<string, FileCommand<any, any, any, any>>,
  cliName: string
): string {
  const lines: string[] = [];

  lines.push(`Usage: ${cliName} <command> [options]`);
  lines.push("");
  lines.push("Commands:");

  // Collect commands with their CLI representation
  const commands: { cli: string; description: string; path: string }[] = [];

  for (const [path, command] of Object.entries(commandsTree)) {
    // Skip layouts (paths ending in pathless segments only)
    const segments = path.split("/").filter(Boolean);
    const isLayout =
      segments.length > 0 &&
      segments[segments.length - 1]?.startsWith("_");

    if (isLayout) continue;

    // Skip root command in the list (it's the default)
    if (path === "/") continue;

    // Build CLI command string
    const cliParts: string[] = [];
    for (const segment of segments) {
      if (segment === "$") {
        // Splat route - show as <items...>
        cliParts.push("<items...>");
      } else if (segment.startsWith("$")) {
        cliParts.push(`<${segment.slice(1)}>`);
      } else if (!segment.startsWith("_")) {
        cliParts.push(segment);
      }
    }

    if (cliParts.length > 0) {
      commands.push({
        cli: cliParts.join(" "),
        description: command.config.description,
        path,
      });
    }
  }

  // Sort commands alphabetically
  commands.sort((a, b) => a.cli.localeCompare(b.cli));

  // Find max command length for padding
  const maxLen = Math.max(...commands.map((c) => c.cli.length), 10);

  for (const cmd of commands) {
    lines.push(`  ${cmd.cli.padEnd(maxLen + 2)} ${cmd.description}`);
  }

  lines.push("");
  lines.push(`Run '${cliName} <command> --help' for more information on a command.`);

  return lines.join("\n");
}

/**
 * Check if help flag is present in args
 */
export function hasHelpFlag(args: Record<string, unknown>): boolean {
  return args.help === true || args.h === true;
}
