import { describe, it, expect } from "bun:test";
import {
  ParseError,
  RunCommandError,
  CommandNotFoundError,
  MiddlewareError,
} from "../errors";

describe("ParseError", () => {
  it("creates error with message, help, and code", () => {
    const error = new ParseError(
      "Invalid argument",
      "Check the argument format",
      "INVALID_ARG"
    );

    expect(error.message).toBe("Invalid argument");
    expect(error.help).toBe("Check the argument format");
    expect(error.code).toBe("INVALID_ARG");
  });

  it('has name "ParseError"', () => {
    const error = new ParseError("test", "help", "UNKNOWN_COMMAND");
    expect(error.name).toBe("ParseError");
  });

  it("is instanceof Error", () => {
    const error = new ParseError("test", "help", "UNKNOWN_COMMAND");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ParseError);
  });

  describe("error codes", () => {
    it("supports UNKNOWN_COMMAND code", () => {
      const error = new ParseError(
        "Unknown command: foo",
        "Available: bar, baz",
        "UNKNOWN_COMMAND"
      );
      expect(error.code).toBe("UNKNOWN_COMMAND");
    });

    it("supports MISSING_ARG code", () => {
      const error = new ParseError(
        "Missing required argument: --name",
        "Provide --name value",
        "MISSING_ARG"
      );
      expect(error.code).toBe("MISSING_ARG");
    });

    it("supports INVALID_ARG code", () => {
      const error = new ParseError(
        "Invalid argument: --count must be a number",
        "Provide a valid number",
        "INVALID_ARG"
      );
      expect(error.code).toBe("INVALID_ARG");
    });

    it("supports MISSING_PARAM code", () => {
      const error = new ParseError(
        "Missing parameter: projectId",
        "Provide a project ID",
        "MISSING_PARAM"
      );
      expect(error.code).toBe("MISSING_PARAM");
    });

    it("supports INVALID_PARAM code", () => {
      const error = new ParseError(
        "Invalid parameter: projectId",
        "Provide a valid project ID",
        "INVALID_PARAM"
      );
      expect(error.code).toBe("INVALID_PARAM");
    });

    it("supports VALIDATION_ERROR code", () => {
      const error = new ParseError(
        "Validation failed",
        "Check input format",
        "VALIDATION_ERROR"
      );
      expect(error.code).toBe("VALIDATION_ERROR");
    });
  });

  it("has stack trace", () => {
    const error = new ParseError("test", "help", "UNKNOWN_COMMAND");
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("ParseError");
  });
});

describe("RunCommandError", () => {
  it("creates error with path", () => {
    const error = new RunCommandError("/auth");

    expect(error.path).toBe("/auth");
    expect(error.args).toBeUndefined();
  });

  it("creates error with path and args", () => {
    const error = new RunCommandError("/users/$userId", {
      userId: "123",
      verbose: true,
    });

    expect(error.path).toBe("/users/$userId");
    expect(error.args).toEqual({ userId: "123", verbose: true });
  });

  it('has name "RunCommandError"', () => {
    const error = new RunCommandError("/test");
    expect(error.name).toBe("RunCommandError");
  });

  it("is instanceof Error", () => {
    const error = new RunCommandError("/test");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RunCommandError);
  });

  it("has descriptive message", () => {
    const error = new RunCommandError("/auth/login");
    expect(error.message).toContain("/auth/login");
  });

  it("preserves args in message", () => {
    const error = new RunCommandError("/test", { foo: "bar" });
    expect(error.message).toContain("Run command: /test");
  });
});

describe("CommandNotFoundError", () => {
  it("creates error with path and available commands", () => {
    const error = new CommandNotFoundError("foo", ["bar", "baz", "qux"]);

    expect(error.path).toBe("foo");
    expect(error.availableCommands).toEqual(["bar", "baz", "qux"]);
  });

  it('has name "CommandNotFoundError"', () => {
    const error = new CommandNotFoundError("test", []);
    expect(error.name).toBe("CommandNotFoundError");
  });

  it("is instanceof Error", () => {
    const error = new CommandNotFoundError("test", []);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CommandNotFoundError);
  });

  it("has descriptive message", () => {
    const error = new CommandNotFoundError("unknown-cmd", ["a", "b"]);
    expect(error.message).toContain("unknown-cmd");
  });

  it("help getter lists available commands", () => {
    const error = new CommandNotFoundError("foo", ["auth", "list", "add"]);

    const help = error.help;
    expect(help).toContain("Available commands:");
    expect(help).toContain("auth");
    expect(help).toContain("list");
    expect(help).toContain("add");
  });

  it("help getter handles empty available commands", () => {
    const error = new CommandNotFoundError("foo", []);

    const help = error.help;
    // When no commands are available, shows appropriate message
    expect(help).toContain("No commands available");
    expect(typeof help).toBe("string");
  });
});

describe("MiddlewareError", () => {
  it("creates error with message and original error", () => {
    const original = new Error("original error");
    const error = new MiddlewareError("Middleware failed", original);

    expect(error.message).toBe("Middleware failed");
    expect(error.originalError).toBe(original);
  });

  it('has name "MiddlewareError"', () => {
    const error = new MiddlewareError("test", new Error("original"));
    expect(error.name).toBe("MiddlewareError");
  });

  it("is instanceof Error", () => {
    const error = new MiddlewareError("test", new Error("original"));
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MiddlewareError);
  });

  it("preserves original error type", () => {
    class CustomError extends Error {
      customProp = "custom";
    }

    const original = new CustomError("custom error");
    const error = new MiddlewareError("wrapped", original);

    expect(error.originalError).toBeInstanceOf(CustomError);
    expect((error.originalError as CustomError).customProp).toBe("custom");
  });

  it("has stack trace", () => {
    const error = new MiddlewareError("test", new Error("original"));
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain("MiddlewareError");
  });

  it("original error stack is preserved", () => {
    const original = new Error("original");
    const error = new MiddlewareError("wrapped", original);

    expect(error.originalError.stack).toBeDefined();
    expect(error.originalError.stack).toContain("original");
  });
});

describe("error inheritance chain", () => {
  it("all errors extend Error", () => {
    expect(new ParseError("", "", "UNKNOWN_COMMAND")).toBeInstanceOf(Error);
    expect(new RunCommandError("/")).toBeInstanceOf(Error);
    expect(new CommandNotFoundError("", [])).toBeInstanceOf(Error);
    expect(new MiddlewareError("", new Error())).toBeInstanceOf(Error);
  });

  it("errors can be caught generically", () => {
    const errors = [
      new ParseError("", "", "UNKNOWN_COMMAND"),
      new RunCommandError("/"),
      new CommandNotFoundError("", []),
      new MiddlewareError("", new Error()),
    ];

    for (const error of errors) {
      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it("errors can be caught by specific type", () => {
    const parseError = new ParseError("", "", "UNKNOWN_COMMAND");
    const runCommandError = new RunCommandError("/");

    try {
      throw parseError;
    } catch (e) {
      if (e instanceof ParseError) {
        expect(e.code).toBe("UNKNOWN_COMMAND");
      } else {
        throw new Error("Wrong error type");
      }
    }

    try {
      throw runCommandError;
    } catch (e) {
      if (e instanceof RunCommandError) {
        expect(e.path).toBe("/");
      } else {
        throw new Error("Wrong error type");
      }
    }
  });
});
