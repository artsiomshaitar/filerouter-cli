// Core factories

export { commandInfo, registerCommands } from "./commandInfo";
export { createFileCommand } from "./createFileCommand";
export { createRootCommand, type RootCommand, type RootCommandConfig } from "./createRootCommand";
// Generator (used by CLI tooling and dev mode)
export {
  type CommandType,
  type GeneratorConfig,
  generateCommandsTree,
  type ScannedCommand,
  type ScanResult,
  scaffoldIfEmpty,
  scanCommands,
} from "./generator";
export { createGuard } from "./middleware";
// Used by generated commandsTree.gen.ts
export { createParseRoute, extractRouteParams, type RouteTable } from "./parseRoute";
export { createCommandsRouter } from "./router";
// Runtime helpers
export { type EmptyParams, type Register, type RegisteredContext, runCommand } from "./runCommand";
// Types
export type {
  AnyCommand,
  CommandConfig,
  CommandHandler,
  CommandInfo,
  FieldInfo,
  FileCommand,
  FileCommandsByPath,
  FileCommandUpdateOptions,
  HandlerContext,
  Middleware,
  ParamInfo,
  ParsedRoute,
  Router,
  RouterConfig,
} from "./types";
