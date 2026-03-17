import type { z } from "zod";
import { routePathToCliCommand } from "./generator/scanner";
import { extractRouteParams } from "./parseRoute";
import type { FieldInfo, FileCommand } from "./types";

export function extractFieldsFromZodSchema(schema: z.ZodTypeAny | undefined): FieldInfo[] {
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

function extractFieldInfo(name: string, schema: z.ZodTypeAny): FieldInfo {
  let currentSchema = schema;
  let isOptional = false;
  let defaultValue: unknown;
  let description: string | undefined;

  if ("_def" in currentSchema) {
    const def = currentSchema._def as Record<string, unknown>;

    if (def.typeName === "ZodDefault") {
      const defaultFn = def.defaultValue as (() => unknown) | unknown;
      defaultValue = typeof defaultFn === "function" ? defaultFn() : defaultFn;
      currentSchema = def.innerType as z.ZodTypeAny;
    }

    if (def.typeName === "ZodOptional") {
      isOptional = true;
      currentSchema = def.innerType as z.ZodTypeAny;
    }

    if (typeof def.description === "string") {
      description = def.description;
    }
  }

  if (typeof schema.isOptional === "function" && schema.isOptional()) {
    isOptional = true;
  }

  const type = getZodTypeName(currentSchema);

  // Description may be on the inner type after unwrapping optional/default
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
    case "ZodEnum": {
      const values = (def.values as string[]) || [];
      return values.join(" | ");
    }
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
  paramsDescription?: Record<string, string>,
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
  if (paramsDescription?.[paramName]) {
    return paramsDescription[paramName];
  }

  return undefined;
}

export function generateCommandHelp(
  command: FileCommand<any, any, any, any>,
  cliName: string,
  routePath: string,
  _aliases?: Record<string, string[]>,
): string {
  const lines: string[] = [];
  const config = command.config;

  const cliCmd = routePathToCliCommand(routePath);
  const headerCmd = cliCmd ? `${cliName} ${cliCmd}` : cliName;
  const paramNames = extractRouteParams(routePath);
  const isSplat = paramNames.includes("_splat");

  lines.push(`${headerCmd} - ${config.description}`);
  lines.push("");

  if (isSplat) {
    const usageCmd = headerCmd.replace("<items...>", "[items...]");
    lines.push(`Usage: ${usageCmd} [options]`);
  } else {
    lines.push(`Usage: ${headerCmd} [options]`);
  }
  lines.push("");

  if (paramNames.length > 0) {
    lines.push("Arguments:");
    for (const paramName of paramNames) {
      const desc = getParamDescription(
        paramName,
        config.validateParams,
        config.paramsDescription as Record<string, string> | undefined,
      );

      const isSplatParam = paramName === "_splat";
      const displayName = isSplatParam ? "items" : paramName;
      const required = isSplatParam ? "(optional, variadic)" : "(required)";

      lines.push(`  ${displayName.padEnd(16)} ${desc || ""} ${required}`);
    }
    lines.push("");
  }

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

    const typeHint = field.type === "boolean" ? "" : ` <${field.type}>`;
    lines.push(`  ${(flagName + typeHint).padEnd(24)} ${desc}`);
  }

  lines.push(`  ${"--help, -h".padEnd(24)} Show this help message`);

  return lines.join("\n");
}

export function generateGlobalHelp(
  commandsTree: Record<string, FileCommand<any, any, any, any>>,
  cliName: string,
): string {
  const lines: string[] = [];

  lines.push(`Usage: ${cliName} <command> [options]`);
  lines.push("");
  lines.push("Commands:");

  const commands: { cli: string; description: string; path: string }[] = [];

  for (const [path, command] of Object.entries(commandsTree)) {
    // Skip layouts (paths ending in pathless segments only)
    const segments = path.split("/").filter(Boolean);
    const isLayout = segments.length > 0 && segments[segments.length - 1]?.startsWith("_");

    if (isLayout) continue;

    // Skip root command in the list (it's the default)
    if (path === "/") continue;

    const cli = routePathToCliCommand(path);
    if (cli) {
      commands.push({
        cli,
        description: command.config.description,
        path,
      });
    }
  }

  commands.sort((a, b) => a.cli.localeCompare(b.cli));
  const maxLen = Math.max(...commands.map((c) => c.cli.length), 10);

  for (const cmd of commands) {
    lines.push(`  ${cmd.cli.padEnd(maxLen + 2)} ${cmd.description}`);
  }

  lines.push("");
  lines.push(`Run '${cliName} <command> --help' for more information on a command.`);

  return lines.join("\n");
}

export function hasHelpFlag(args: Record<string, unknown>): boolean {
  return args.help === true || args.h === true;
}
