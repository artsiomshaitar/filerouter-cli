/**
 * Scanned command file information
 */
export interface ScannedCommand {
  /** Relative file path from commands directory (e.g., "list/$projectId.ts") */
  filePath: string;
  /** Route path derived from file path (e.g., "/list/$projectId") */
  routePath: string;
  /** Whether this is a layout file (route.ts or index.ts in a _ prefixed folder) */
  isLayout: boolean;
  /** Whether this is a pathless layout (path starts with _) */
  isPathless: boolean;
  /** Whether path contains dynamic parameters ($param) */
  hasParams: boolean;
  /** Whether this is a splat route ($.ts file that captures remaining args) */
  isSplat: boolean;
  /** Path segments (e.g., ["list", "$projectId"]) */
  segments: string[];
  /** Parameter names extracted from path (e.g., ["projectId"] or ["_splat"] for splat routes) */
  paramNames: string[];
}

/**
 * Generator configuration
 */
export interface GeneratorConfig {
  /** Directory containing command files (relative to project root) */
  commandsDirectory: string;
  /** Output file path for generated commands tree */
  generatedFile: string;
  /** CLI name for usage generation */
  cliName?: string;
}

/**
 * File system scanner result
 */
export interface ScanResult {
  /** All scanned commands */
  commands: ScannedCommand[];
  /** Root directory that was scanned */
  rootDir: string;
}
