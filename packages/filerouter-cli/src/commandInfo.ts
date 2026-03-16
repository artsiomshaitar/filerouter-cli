import type { FileCommand, CommandInfo, FieldInfo, ParamInfo } from "./types";
import type { Register } from "./runCommand";
import { extractFieldsFromZodSchema } from "./help";

// Registry for commands tree (populated by generated code at import time)
let registeredTree: Record<string, FileCommand<any, any, any, any>> | null =
  null;
let registeredCliName: string = "cli";

/**
 * Register the commands tree for use with commandInfo()
 * This is called automatically by the generated commandsTree.gen.ts
 */
export function registerCommands(
  tree: Record<string, FileCommand<any, any, any, any>>,
  cliName?: string
): void {
  registeredTree = tree;
  if (cliName) registeredCliName = cliName;
}

/**
 * Get the registered CLI name
 */
export function getRegisteredCliName(): string {
  return registeredCliName;
}

/**
 * Extract param info from a route path
 */
function extractParamInfo(
  path: string,
  validateParams?: unknown,
  paramsDescription?: Record<string, string>
): ParamInfo[] {
  const params: ParamInfo[] = [];
  const segments = path.split("/").filter(Boolean);

  for (const segment of segments) {
    if (segment === "$") {
      // Splat route
      const description = paramsDescription?.["_splat"];
      params.push({
        name: "_splat",
        description,
        isSplat: true,
      });
    } else if (segment.startsWith("$")) {
      const paramName = segment.slice(1);
      // Try to get description from paramsDescription or validateParams schema
      let description = paramsDescription?.[paramName];

      // If validateParams is a Zod schema, try to extract description
      if (!description && validateParams && typeof validateParams === "object") {
        const schema = validateParams as { shape?: Record<string, unknown> };
        if (schema.shape && schema.shape[paramName]) {
          const fieldSchema = schema.shape[paramName] as {
            _def?: { description?: string };
          };
          description = fieldSchema?._def?.description;
        }
      }

      params.push({
        name: paramName,
        description,
        isSplat: false,
      });
    }
  }

  return params;
}

/**
 * Build the CLI command string (without args)
 */
function buildCommand(path: string, cliName: string): string {
  const segments = path.split("/").filter(Boolean);
  const parts: string[] = [cliName];

  for (const segment of segments) {
    if (segment === "$") {
      parts.push("<items...>");
    } else if (segment.startsWith("$")) {
      parts.push(`<${segment.slice(1)}>`);
    } else if (!segment.startsWith("_")) {
      parts.push(segment);
    }
  }

  return parts.join(" ");
}

/**
 * Build the usage string (command + args)
 */
function buildUsage(
  path: string,
  cliName: string,
  argsFields: FieldInfo[]
): string {
  let usage = buildCommand(path, cliName);

  // Add args from schema
  for (const field of argsFields) {
    if (field.type === "boolean") {
      if (field.isOptional) {
        usage += ` [--${field.name}]`;
      } else {
        usage += ` --${field.name}`;
      }
    } else {
      if (field.isOptional) {
        usage += ` [--${field.name} <${field.type}>]`;
      } else {
        usage += ` --${field.name} <${field.type}>`;
      }
    }
  }

  return usage;
}

/**
 * Build full usage text (like --help output)
 */
function buildFullUsage(
  path: string,
  cliName: string,
  description: string,
  argsFields: FieldInfo[],
  paramsInfo: ParamInfo[],
  aliases?: Record<string, string[]>
): string {
  const lines: string[] = [];
  const command = buildCommand(path, cliName);

  // Header
  lines.push(`${command} - ${description}`);
  lines.push("");

  // Usage line
  const usage = buildUsage(path, cliName, argsFields);
  lines.push(`Usage: ${usage}`);
  lines.push("");

  // Arguments (path params)
  if (paramsInfo.length > 0) {
    lines.push("Arguments:");
    for (const param of paramsInfo) {
      const displayName = param.isSplat ? "items" : param.name;
      const required = param.isSplat ? "(optional, variadic)" : "(required)";
      const desc = param.description || "";
      lines.push(`  ${displayName.padEnd(16)} ${desc} ${required}`);
    }
    lines.push("");
  }

  // Options (args/flags)
  if (argsFields.length > 0) {
    lines.push("Options:");
    for (const field of argsFields) {
      const fieldAliases = aliases?.[field.name];
      const aliasStr = fieldAliases ? `, -${fieldAliases.join(", -")}` : "";
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
    lines.push("");
  }

  // Help flag
  lines.push("  --help, -h              Show this help message");

  return lines.join("\n");
}

// Type helper to get registered command path
type RegisteredCommandPath = Register extends { commandPath: infer P }
  ? P
  : string;

/**
 * Get type-safe information about a command
 *
 * @example
 * ```typescript
 * commandInfo("/auth").description      // "Authorize in the my-cli"
 * commandInfo("/auth").command()        // "my-cli auth"
 * commandInfo("/auth").usage()          // "my-cli auth --username <string> --password <string>"
 * commandInfo("/auth").args             // [{ name: "username", type: "string", ... }, ...]
 * commandInfo("/auth").params           // []
 * commandInfo("/auth").fullUsage()      // Full help text
 * ```
 *
 * @throws Error if commands are not registered (ensure commandsTree.gen.ts is imported)
 * @throws Error if the command path is not found
 */
export function commandInfo<TPath extends RegisteredCommandPath>(
  path: TPath
): CommandInfo {
  if (!registeredTree) {
    throw new Error(
      "Commands not registered. Ensure your commandsTree.gen.ts is imported before using commandInfo()."
    );
  }

  const cmd = registeredTree[path];
  if (!cmd) {
    throw new Error(`Command not found: ${path}`);
  }

  const config = cmd.config;
  const argsFields = extractFieldsFromZodSchema(config.validateArgs);
  const paramsInfo = extractParamInfo(
    path,
    config.validateParams,
    config.paramsDescription as Record<string, string> | undefined
  );

  return {
    description: config.description,

    command(): string {
      return buildCommand(path, registeredCliName);
    },

    usage(): string {
      return buildUsage(path, registeredCliName, argsFields);
    },

    args: argsFields,

    params: paramsInfo,

    fullUsage(): string {
      return buildFullUsage(
        path,
        registeredCliName,
        config.description,
        argsFields,
        paramsInfo,
        config.aliases
      );
    },
  };
}
