import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { generateCompletion } from "../../cli/completion";

describe("generateCompletion", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let logOutput: string[];
  let errorOutput: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    logOutput = [];
    errorOutput = [];
    exitCode = undefined;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
    console.log = (...args: unknown[]) => logOutput.push(args.join(" "));
    console.error = (...args: unknown[]) => errorOutput.push(args.join(" "));
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe("no shell argument", () => {
    it("prints usage help when no shell is specified", () => {
      generateCompletion();

      const output = logOutput.join("\n");
      expect(output).toContain("Usage: filerouter-cli completion <shell>");
      expect(output).toContain("bash");
      expect(output).toContain("zsh");
      expect(output).toContain("fish");
    });

    it("includes installation instructions", () => {
      generateCompletion();

      const output = logOutput.join("\n");
      expect(output).toContain("~/.bashrc");
      expect(output).toContain("~/.zshrc");
      expect(output).toContain("~/.config/fish/completions");
    });
  });

  describe("bash completion", () => {
    it("generates bash completion script", () => {
      generateCompletion("bash");

      const output = logOutput.join("\n");
      expect(output).toContain("_filerouter_cli_completions");
      expect(output).toContain("complete -F");
      expect(output).toContain("filerouter-cli");
    });

    it("includes filerouter-cli subcommands", () => {
      generateCompletion("bash");

      const output = logOutput.join("\n");
      expect(output).toContain("init");
      expect(output).toContain("dev");
      expect(output).toContain("generate");
      expect(output).toContain("completion");
    });

    it("includes global options", () => {
      generateCompletion("bash");

      const output = logOutput.join("\n");
      expect(output).toContain("--help");
      expect(output).toContain("--version");
    });
  });

  describe("zsh completion", () => {
    it("generates zsh completion script", () => {
      generateCompletion("zsh");

      const output = logOutput.join("\n");
      expect(output).toContain("#compdef filerouter-cli");
      expect(output).toContain("_filerouter_cli");
    });

    it("includes command descriptions", () => {
      generateCompletion("zsh");

      const output = logOutput.join("\n");
      expect(output).toContain("Create a new filerouter-cli project");
      expect(output).toContain("Start interactive dev mode");
      expect(output).toContain("Generate commandsTree.gen.ts");
    });

    it("includes common options with descriptions", () => {
      generateCompletion("zsh");

      const output = logOutput.join("\n");
      expect(output).toContain("--commands");
      expect(output).toContain("--output");
      expect(output).toContain("--name");
    });
  });

  describe("fish completion", () => {
    it("generates fish completion script", () => {
      generateCompletion("fish");

      const output = logOutput.join("\n");
      expect(output).toContain("complete -c filerouter-cli");
      expect(output).toContain("__fish_use_subcommand");
    });

    it("includes all subcommands with descriptions", () => {
      generateCompletion("fish");

      const output = logOutput.join("\n");
      expect(output).toContain('"init"');
      expect(output).toContain('"dev"');
      expect(output).toContain('"generate"');
      expect(output).toContain('"completion"');
    });

    it("includes shell sub-completions for completion command", () => {
      generateCompletion("fish");

      const output = logOutput.join("\n");
      expect(output).toContain('"bash"');
      expect(output).toContain('"zsh"');
      expect(output).toContain('"fish"');
    });
  });

  describe("case insensitivity", () => {
    it("accepts uppercase shell names", () => {
      generateCompletion("BASH");

      const output = logOutput.join("\n");
      expect(output).toContain("_filerouter_cli_completions");
    });

    it("accepts mixed case shell names", () => {
      generateCompletion("Zsh");

      const output = logOutput.join("\n");
      expect(output).toContain("#compdef filerouter-cli");
    });
  });

  describe("unknown shell", () => {
    it("prints error and exits for unknown shell", () => {
      try {
        generateCompletion("powershell");
      } catch {
        // expected: process.exit(1) throws
      }

      expect(exitCode).toBe(1);
      expect(errorOutput.some((l) => l.includes("Unknown shell: powershell"))).toBe(true);
      expect(errorOutput.some((l) => l.includes("Supported shells"))).toBe(true);
    });
  });
});
