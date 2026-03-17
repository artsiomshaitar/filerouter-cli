export { generateCommandsTree } from "./codegen";
export {
  type CommandType,
  detectCommandType,
  extractParamNames,
  filePathToRoutePath,
  generateBoilerplate,
  generateBoilerplateForFile,
  isFileEmpty,
  scaffoldIfEmpty,
} from "./scaffold";
export { routePathToCliCommand, routePathToVarName, scanCommands } from "./scanner";
export type {
  GeneratorConfig,
  ScannedCommand,
  ScanResult,
} from "./types";
