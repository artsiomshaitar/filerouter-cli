// Core exports
export { createFileCommand } from "./createFileCommand";
export { createRootCommand, type RootCommand, type RootCommandConfig } from "./createRootCommand";
export { createCommandsRouter } from "./router";

// Run command (type-safe command invocation)
export { runCommand, isRunCommand, type Register, type RegisteredContext, type EmptyParams } from "./runCommand";

// Error types
export {
  ParseError,
  RunCommandError,
  CommandNotFoundError,
  MiddlewareError,
  type ParseErrorCode,
} from "./errors";

// Parser utilities
export {
  parseRawArgs,
  validateArgs,
  validateParams,
  expandAliases,
  extractBooleanFlags,
  extractValidFlags,
  suggestSimilarFlags,
  formatUnknownFlagsError,
  type ParsedArgs,
  type ParseOptions,
  type ValidateArgsOptions,
  type FlagInfo,
} from "./parser";

// Middleware utilities
export { executeMiddleware, createGuard } from "./middleware";

// Shell helper
export { getShell, $ } from "./shell";

// Help utilities
export {
  generateCommandHelp,
  generateGlobalHelp,
  hasHelpFlag,
  extractFieldsFromZodSchema,
} from "./help";

// Command info (type-safe command introspection)
export { commandInfo, registerCommands } from "./commandInfo";

// Route parsing (used by generated code)
export { createParseRoute, type RouteTable } from "./parseRoute";

// Types
export type {
  // Core types
  FileCommand,
  FileCommandsByPath,
  FileCommandUpdateOptions,
  AnyCommand,
  CommandConfig,
  RouterConfig,
  ParsedRoute,
  Router,
  CommandInfo,
  FieldInfo,
  ParamInfo,
  // Handler types
  HandlerContext,
  CommandHandler,
  Middleware,
  ShellFn,
} from "./types";

// Generator exports
export {
  // Scanner
  scanCommands,
  routePathToVarName,
  routePathToCliCommand,
  // Code generation
  generateCommandsTree,
  // Scaffolding
  isFileEmpty,
  detectCommandType,
  extractParamNames,
  filePathToRoutePath,
  generateBoilerplate,
  generateBoilerplateForFile,
  scaffoldIfEmpty,
  type CommandType,
  // Types
  type ScannedCommand,
  type GeneratorConfig,
  type ScanResult,
} from "./generator";
