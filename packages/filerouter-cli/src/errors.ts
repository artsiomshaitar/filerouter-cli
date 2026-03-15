/**
 * Error codes for ParseError
 */
export type ParseErrorCode =
  | "UNKNOWN_COMMAND"
  | "MISSING_ARG"
  | "INVALID_ARG"
  | "MISSING_PARAM"
  | "INVALID_PARAM"
  | "VALIDATION_ERROR";

/**
 * Error thrown when parsing command-line arguments fails
 */
export class ParseError extends Error {
  public readonly name = "ParseError";

  constructor(
    message: string,
    public readonly help: string,
    public readonly code: ParseErrorCode
  ) {
    super(message);
  }
}

/**
 * Error thrown by runCommand() to execute another command
 * Caught by the router to run the target command
 */
export class RunCommandError extends Error {
  public readonly name = "RunCommandError";

  constructor(
    public readonly path: string,
    public readonly args?: Record<string, unknown>
  ) {
    super(`Run command: ${path}`);
  }
}

/**
 * Error thrown when a command is not found
 */
export class CommandNotFoundError extends Error {
  public readonly name = "CommandNotFoundError";

  constructor(
    public readonly path: string,
    public readonly availableCommands: string[]
  ) {
    super(`Command not found: ${path}`);
  }

  get help(): string {
    if (this.availableCommands.length === 0) {
      return "No commands available.";
    }
    return `Available commands:\n${this.availableCommands.map((c) => `  ${c}`).join("\n")}`;
  }
}

/**
 * Error thrown when middleware fails
 */
export class MiddlewareError extends Error {
  public readonly name = "MiddlewareError";

  constructor(
    message: string,
    public readonly originalError: Error
  ) {
    super(message);
  }
}
