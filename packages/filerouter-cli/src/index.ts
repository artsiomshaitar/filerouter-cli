// Core exports
export { createFileCommand } from "./createFileCommand";
export { createCommandsRouter } from "./router";

// Error types
export {
  ParseError,
  RedirectError,
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
  type ParsedArgs,
  type ParseOptions,
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

// Types
export type {
  // Core types
  FileCommand,
  CommandConfig,
  RouterConfig,
  ParsedRoute,
  Router,
  CommandInfo,
  // Handler types
  HandlerContext,
  CommandHandler,
  Middleware,
  RedirectFn,
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
