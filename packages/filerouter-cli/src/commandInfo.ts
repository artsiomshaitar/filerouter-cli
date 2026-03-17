import { routePathToCliCommand } from "./generator/scanner";
import { extractFieldsFromZodSchema } from "./help";
import type { Register } from "./runCommand";
import type { CommandInfo, FieldInfo, FileCommand, ParamInfo } from "./types";

let registeredTree: Record<string, FileCommand<any, any, any, any>> | null = null;
let registeredCliName: string = "cli";

/** Called automatically by the generated commandsTree.gen.ts at import time. */
export function registerCommands(tree: Record<string, FileCommand<any, any, any, any>>): void {
  registeredTree = tree;
}

export function setCliName(name: string): void {
  registeredCliName = name;
}

function extractParamInfo(
  path: string,
  validateParams?: unknown,
  paramsDescription?: Record<string, string>,
): ParamInfo[] {
  const params: ParamInfo[] = [];
  const segments = path.split("/").filter(Boolean);

  for (const segment of segments) {
    if (segment === "$") {
      const description = paramsDescription?._splat;
      params.push({
        name: "_splat",
        description,
        isSplat: true,
      });
    } else if (segment.startsWith("$")) {
      const paramName = segment.slice(1);
      let description = paramsDescription?.[paramName];

      if (!description && validateParams && typeof validateParams === "object") {
        const schema = validateParams as { shape?: Record<string, unknown> };
        if (schema.shape?.[paramName]) {
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

function buildCommand(path: string, cliName: string): string {
  const cliCmd = routePathToCliCommand(path);
  return cliCmd ? `${cliName} ${cliCmd}` : cliName;
}

function buildUsage(path: string, cliName: string, argsFields: FieldInfo[]): string {
  let usage = buildCommand(path, cliName);

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

function buildFullUsage(
  path: string,
  cliName: string,
  description: string,
  argsFields: FieldInfo[],
  paramsInfo: ParamInfo[],
  aliases?: Record<string, string[]>,
): string {
  const lines: string[] = [];
  const command = buildCommand(path, cliName);

  lines.push(`${command} - ${description}`);
  lines.push("");

  const usage = buildUsage(path, cliName, argsFields);
  lines.push(`Usage: ${usage}`);
  lines.push("");

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

  lines.push("  --help, -h              Show this help message");

  return lines.join("\n");
}

type RegisteredCommandPath = Register extends { commandPath: infer P } ? P : string;

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
export function commandInfo<TPath extends RegisteredCommandPath>(path: TPath): CommandInfo {
  if (!registeredTree) {
    throw new Error(
      "Commands not registered. Ensure your commandsTree.gen.ts is imported before using commandInfo().",
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
    config.paramsDescription as Record<string, string> | undefined,
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
        config.aliases,
      );
    },
  };
}
