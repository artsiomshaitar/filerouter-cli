// Scanner
export { scanCommands, routePathToVarName, routePathToCliCommand } from "./scanner";

// Code generation
export { generateCommandsTree } from "./codegen";

// Scaffolding
export {
  isFileEmpty,
  detectCommandType,
  extractParamNames,
  filePathToRoutePath,
  generateBoilerplate,
  generateBoilerplateForFile,
  scaffoldIfEmpty,
  type CommandType,
} from "./scaffold";

// Types
export type {
  ScannedCommand,
  GeneratorConfig,
  ScanResult,
} from "./types";
