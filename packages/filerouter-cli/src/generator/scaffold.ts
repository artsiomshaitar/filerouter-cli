import * as fs from "fs";
import * as path from "path";

/**
 * Command type based on file location and naming
 */
export type CommandType = "basic" | "params" | "layout" | "index" | "splat";

/**
 * Check if a file is empty (0 bytes or only whitespace)
 */
export async function isFileEmpty(filePath: string): Promise<boolean> {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return content.trim() === "";
  } catch {
    // File doesn't exist or can't be read
    return false;
  }
}

/**
 * Detect the command type from the file path
 */
export function detectCommandType(filePath: string, commandsDirectory: string): CommandType {
  const relativePath = path.relative(commandsDirectory, filePath);
  const parsed = path.parse(relativePath);
  const fileName = parsed.name;
  const dirName = path.dirname(relativePath);

  // Check if this is a layout file (route.ts in a _ prefixed directory)
  if (fileName === "route") {
    const segments = dirName.split(path.sep);
    const lastDir = segments[segments.length - 1];
    if (lastDir?.startsWith("_")) {
      return "layout";
    }
  }

  // Check if this is an index file
  if (fileName === "index") {
    return "index";
  }

  // Check if this is a splat file ($.ts or $.tsx)
  if (fileName === "$") {
    return "splat";
  }

  // Check if filename contains params ($param)
  if (fileName.startsWith("$") || fileName.includes("$")) {
    return "params";
  }

  // Check if any directory in the path contains params
  const segments = relativePath.split(path.sep);
  for (const segment of segments) {
    if (segment.startsWith("$")) {
      return "params";
    }
  }

  return "basic";
}

/**
 * Extract parameter names from a file path
 *
 * Examples:
 * - "$projectId.ts" -> ["projectId"]
 * - "users/$userId.ts" -> ["userId"]
 * - "$org/$repo.ts" -> ["org", "repo"]
 * - "add/$.ts" -> ["_splat"]
 */
export function extractParamNames(filePath: string, commandsDirectory: string): string[] {
  const relativePath = path.relative(commandsDirectory, filePath);
  const withoutExt = relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  const segments = withoutExt.split(path.sep);

  const params: string[] = [];

  for (const segment of segments) {
    if (segment === "$") {
      // Splat parameter
      params.push("_splat");
    } else if (segment.startsWith("$")) {
      params.push(segment.slice(1));
    }
  }

  return params;
}

/**
 * Calculate the route path from a file path
 *
 * Examples:
 * - "deploy.ts" -> "/deploy"
 * - "list/index.ts" -> "/list"
 * - "list/$projectId.ts" -> "/list/$projectId"
 * - "_auth/route.ts" -> "/_auth"
 * - "_auth/protected.ts" -> "/_auth/protected"
 */
export function filePathToRoutePath(filePath: string, commandsDirectory: string): string {
  const relativePath = path.relative(commandsDirectory, filePath);
  const withoutExt = relativePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  const segments = withoutExt.split(path.sep).filter(Boolean);

  // Handle index files
  const lastSegment = segments[segments.length - 1];
  if (lastSegment === "index" || lastSegment === "route") {
    segments.pop();
  }

  // Build route path
  if (segments.length === 0) {
    return "/";
  }

  return `/${segments.join("/")}`;
}

/**
 * Generate boilerplate code for a command file
 */
export function generateBoilerplate(
  routePath: string,
  type: CommandType,
  paramNames: string[],
): string {
  const lines: string[] = [];

  // Imports
  lines.push('import { createFileCommand } from "filerouter-cli";');

  // Only need zod import for params type (not splat - uses paramsDescription)
  if (type === "params" && paramNames.length > 0) {
    lines.push('import { z } from "zod";');
  }

  lines.push("");

  // Command export
  lines.push(`export const Command = createFileCommand("${routePath}")({`);
  lines.push('  description: "TODO: Add description",');

  // Add validateParams for param commands (not splat)
  if (type === "params" && paramNames.length > 0) {
    lines.push("  validateParams: z.object({");
    for (const param of paramNames) {
      lines.push(`    ${param}: z.string(),`);
    }
    lines.push("  }),");
  }

  // Add paramsDescription for splat routes
  if (type === "splat") {
    lines.push("  paramsDescription: {");
    lines.push('    _splat: "Items to process",');
    lines.push("  },");
  }

  // Handler
  if (type === "layout") {
    lines.push("  handler: async ({ outlet }) => {");
    lines.push("    const childOutput = await outlet;");
    lines.push("    return childOutput;");
    lines.push("  },");
  } else if (type === "splat") {
    // Splat handler - access params._splat as string[]
    const commandName =
      routePath.replace(/\/\$$/, "").split("/").filter(Boolean).pop() || "command";
    lines.push("  handler: async ({ params }) => {");
    lines.push("    const items = params._splat;");
    lines.push("    if (items.length === 0) {");
    lines.push(`      return "Usage: ${commandName} <items...>";`);
    lines.push("    }");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: generating template literal source code
    lines.push('    return `Processing: ${items.join(", ")}`;');
    lines.push("  },");
  } else if (type === "params" && paramNames.length > 0) {
    lines.push("  handler: async ({ params }) => {");
    const paramStr = paramNames.map((p) => `\${params.${p}}`).join(", ");
    lines.push(`    return \`${paramStr}\`;`);
    lines.push("  },");
  } else {
    // Extract command name from route path for basic/index
    const commandName =
      routePath === "/" ? "root" : routePath.split("/").filter(Boolean).pop() || "command";
    lines.push("  handler: async () => {");
    lines.push(`    return "${commandName} command";`);
    lines.push("  },");
  }

  lines.push("});");
  lines.push("");

  return lines.join("\n");
}

/**
 * Generate boilerplate for a file based on its path
 */
export function generateBoilerplateForFile(filePath: string, commandsDirectory: string): string {
  const type = detectCommandType(filePath, commandsDirectory);
  const routePath = filePathToRoutePath(filePath, commandsDirectory);
  const paramNames = extractParamNames(filePath, commandsDirectory);

  return generateBoilerplate(routePath, type, paramNames);
}

/**
 * Scaffold a new command file if it's empty
 * Returns true if file was scaffolded, false otherwise
 */
export async function scaffoldIfEmpty(
  filePath: string,
  commandsDirectory: string,
): Promise<boolean> {
  const isEmpty = await isFileEmpty(filePath);

  if (!isEmpty) {
    return false;
  }

  const boilerplate = generateBoilerplateForFile(filePath, commandsDirectory);
  await fs.promises.writeFile(filePath, boilerplate, "utf-8");

  return true;
}
