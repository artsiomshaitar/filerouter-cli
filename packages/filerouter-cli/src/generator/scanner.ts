import { Glob } from "bun";
import * as path from "path";
import type { ScannedCommand, ScanResult } from "./types";

/**
 * Supported file extensions for command files
 */
const COMMAND_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/**
 * Files to ignore
 */
const IGNORE_PATTERNS = [
  /^_/, // Files starting with _ at root (but not directories)
  /\.test\./,
  /\.spec\./,
  /\.d\.ts$/,
];

/**
 * Scan a directory for command files
 */
export async function scanCommands(commandsDir: string): Promise<ScanResult> {
  const absoluteDir = path.resolve(commandsDir);
  const glob = new Glob("**/*.{ts,tsx,js,jsx}");
  const commands: ScannedCommand[] = [];

  for await (const file of glob.scan(absoluteDir)) {
    // Skip ignored files
    if (shouldIgnore(file)) continue;

    const parsed = parseFilePath(file);
    if (parsed) {
      commands.push(parsed);
    }
  }

  // Validate: splat routes cannot have children
  validateSplatRoutes(commands);

  // Sort commands by path for consistent output
  commands.sort((a, b) => {
    // Root command first
    if (a.routePath === "/") return -1;
    if (b.routePath === "/") return 1;
    return a.routePath.localeCompare(b.routePath);
  });

  return {
    commands,
    rootDir: absoluteDir,
  };
}

/**
 * Validate that splat routes don't have child routes
 * Throws an error if a splat route has children
 */
function validateSplatRoutes(commands: ScannedCommand[]): void {
  const splatRoutes = commands.filter(c => c.isSplat);
  
  for (const splat of splatRoutes) {
    // Get the parent path (route path without the trailing /$)
    const parentPath = splat.routePath.replace(/\/\$$/, "") || "/";
    
    // Check if any other command is a child of this splat's parent
    // e.g., if splat is /add/$, check for /add/something
    for (const cmd of commands) {
      if (cmd === splat) continue;
      
      // A command is a child if it starts with the parent path + /
      // and is not the splat itself
      const isChild = parentPath === "/" 
        ? cmd.routePath.startsWith("/") && cmd.routePath !== "/" && cmd.routePath !== splat.routePath
        : cmd.routePath.startsWith(parentPath + "/") && cmd.routePath !== splat.routePath;
      
      // But we need to check if it's a SIBLING (same parent) vs a child of the splat
      // Siblings are OK, children of the splat directory are not
      if (isChild) {
        const cmdParent = path.dirname(cmd.filePath);
        const splatDir = path.dirname(splat.filePath);
        
        // If the command's file is inside the splat's directory or a subdirectory, it's an error
        // e.g., splat: add/$.ts, child: add/$/foo.ts or add/$/bar/baz.ts
        if (cmdParent.startsWith(splatDir + "/") || cmdParent === splatDir + "/$") {
          throw new Error(
            `Splat route '${splat.filePath}' cannot have child routes. ` +
            `Found: '${cmd.filePath}'. Splat routes capture all remaining arguments, ` +
            `so child routes would never be matched.`
          );
        }
      }
    }
  }
}

/**
 * Check if a file should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const fileName = path.basename(filePath);

  // Don't ignore route.ts or index.ts files even in _ directories
  if (fileName === "route.ts" || fileName === "route.tsx") return false;

  // Check ignore patterns against filename
  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.test(fileName)) return true;
  }

  return false;
}

/**
 * Parse a file path into a ScannedCommand
 *
 * Conventions:
 * - index.ts -> "/" or parent path
 * - auth.ts -> "/auth"
 * - list/index.ts -> "/list"
 * - list/$projectId.ts -> "/list/$projectId"
 * - _auth/route.ts -> "/_auth" (layout)
 * - _auth/protected.ts -> "/_auth/protected"
 * - add/$.ts -> "/add/$" (splat route, captures remaining args)
 */
function parseFilePath(filePath: string): ScannedCommand | null {
  // Remove extension
  const ext = path.extname(filePath);
  if (!COMMAND_EXTENSIONS.includes(ext)) return null;

  const withoutExt = filePath.slice(0, -ext.length);

  // Split into segments
  const segments = withoutExt.split(path.sep).filter(Boolean);

  // Handle index files
  const lastSegment = segments[segments.length - 1];
  const isIndex = lastSegment === "index";
  const isRoute = lastSegment === "route";
  const isSplat = lastSegment === "$";

  if (isIndex || isRoute) {
    segments.pop();
  }

  // For splat routes, keep the $ in segments but handle specially
  // Route path becomes /parent/$ 

  // Build route path
  let routePath = "/" + segments.join("/");

  // Handle root index
  if (segments.length === 0) {
    routePath = "/";
  }

  // Determine if this is a layout
  const isLayout = isRoute || (isIndex && segments.some((s) => s.startsWith("_")));

  // Determine if this is pathless
  const isPathless = segments.some((s) => s.startsWith("_"));

  // Extract parameter names
  // For splat ($), the param name is "_splat"
  // For regular params ($name), the param name is "name"
  const paramNames = segments
    .filter((s) => s.startsWith("$"))
    .map((s) => s === "$" ? "_splat" : s.slice(1));

  const hasParams = paramNames.length > 0;

  return {
    filePath,
    routePath,
    isLayout,
    isPathless,
    hasParams,
    isSplat,
    segments,
    paramNames,
  };
}

/**
 * Convert a route path to a valid JavaScript variable name
 *
 * Examples:
 * - "/" -> "Root"
 * - "/auth" -> "Auth"
 * - "/list/$projectId" -> "ListProjectId"
 * - "/_auth" -> "LayoutAuth"
 * - "/_auth/protected" -> "LayoutAuthProtected"
 * - "/add/$" -> "AddSplat"
 */
export function routePathToVarName(routePath: string): string {
  if (routePath === "/") return "Root";

  const segments = routePath.split("/").filter(Boolean);
  const hasPathlessLayout = segments.some((s) => s.startsWith("_"));

  const name = segments
    .map((segment) => {
      // Remove _ prefix for pathless layouts but mark it
      if (segment.startsWith("_")) {
        segment = segment.slice(1);
      }
      // Handle splat ($) -> "Splat"
      if (segment === "$") {
        return "Splat";
      }
      // Remove $ prefix for params
      if (segment.startsWith("$")) {
        segment = segment.slice(1);
      }
      // Capitalize first letter
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    })
    .join("");

  // Prefix with "Layout" if it's a pathless layout to avoid conflicts
  return hasPathlessLayout ? `Layout${name}` : name;
}

/**
 * Get the CLI command string for a route
 *
 * Examples:
 * - "/" -> ""
 * - "/auth" -> "auth"
 * - "/list/$projectId" -> "list <projectId>"
 * - "/_auth/protected" -> "protected"
 * - "/add/$" -> "add <items...>"
 */
export function routePathToCliCommand(routePath: string): string {
  if (routePath === "/") return "";

  const segments = routePath.split("/").filter(Boolean);

  return segments
    .filter((s) => !s.startsWith("_"))
    .map((segment) => {
      // Splat route - show as variadic
      if (segment === "$") {
        return "<items...>";
      }
      if (segment.startsWith("$")) {
        return `<${segment.slice(1)}>`;
      }
      return segment;
    })
    .join(" ");
}
