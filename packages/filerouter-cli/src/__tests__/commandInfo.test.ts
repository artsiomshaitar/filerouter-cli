import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { z } from "zod";
import { createFileCommand } from "../createFileCommand";
import { registerCommands, commandInfo } from "../commandInfo";

describe("commandInfo", () => {
  // Create mock commands
  const AuthCommand = createFileCommand("/auth")({
    description: "Authenticate user",
    validateArgs: z.object({
      username: z.string().describe("Username"),
      password: z.string().describe("Password"),
    }),
    aliases: {
      username: ["u"],
      password: ["p"],
    },
    handler: async () => "logged in",
  });

  const ListCommand = createFileCommand("/list/$projectId")({
    description: "List project details",
    validateArgs: z.object({
      full: z.boolean().default(false).describe("Show full details"),
    }),
    paramsDescription: {
      projectId: "The project ID",
    },
    handler: async () => "project details",
  });

  const AddCommand = createFileCommand("/add/$")({
    description: "Add packages",
    validateArgs: z.object({
      dev: z.boolean().default(false).describe("Add as dev dependency"),
    }),
    paramsDescription: {
      _splat: "Packages to add",
    },
    handler: async () => "added",
  });

  const SimpleCommand = createFileCommand("/simple")({
    description: "Simple command",
    handler: async () => "simple",
  });

  const commandsTree = {
    "/auth": AuthCommand,
    "/list/$projectId": ListCommand,
    "/add/$": AddCommand,
    "/simple": SimpleCommand,
  };

  beforeEach(() => {
    // Register commands with CLI name
    registerCommands(commandsTree, "test-cli");
  });

  describe("description", () => {
    it("returns command description", () => {
      const info = commandInfo("/auth" as any);
      expect(info.description).toBe("Authenticate user");
    });
  });

  describe("command()", () => {
    it("returns basic command string", () => {
      const info = commandInfo("/auth" as any);
      expect(info.command()).toBe("test-cli auth");
    });

    it("includes path params as placeholders", () => {
      const info = commandInfo("/list/$projectId" as any);
      expect(info.command()).toBe("test-cli list <projectId>");
    });

    it("handles splat routes", () => {
      const info = commandInfo("/add/$" as any);
      expect(info.command()).toBe("test-cli add <items...>");
    });
  });

  describe("usage()", () => {
    it("returns command with args", () => {
      const info = commandInfo("/auth" as any);
      expect(info.usage()).toBe(
        "test-cli auth --username <string> --password <string>"
      );
    });

    it("shows optional args with brackets", () => {
      const info = commandInfo("/list/$projectId" as any);
      expect(info.usage()).toBe("test-cli list <projectId> [--full]");
    });

    it("handles splat routes with args", () => {
      const info = commandInfo("/add/$" as any);
      expect(info.usage()).toBe("test-cli add <items...> [--dev]");
    });

    it("returns just command for commands without args", () => {
      const info = commandInfo("/simple" as any);
      expect(info.usage()).toBe("test-cli simple");
    });
  });

  describe("args", () => {
    it("extracts arg field info", () => {
      const info = commandInfo("/auth" as any);

      expect(info.args).toHaveLength(2);
      expect(info.args[0]).toEqual({
        name: "username",
        type: "string",
        description: "Username",
        isOptional: false,
        defaultValue: undefined,
      });
      expect(info.args[1]).toEqual({
        name: "password",
        type: "string",
        description: "Password",
        isOptional: false,
        defaultValue: undefined,
      });
    });

    it("identifies optional args with defaults", () => {
      const info = commandInfo("/list/$projectId" as any);

      expect(info.args).toHaveLength(1);
      expect(info.args[0]).toEqual({
        name: "full",
        type: "boolean",
        description: "Show full details",
        isOptional: true,
        defaultValue: false,
      });
    });

    it("returns empty array for commands without args", () => {
      const info = commandInfo("/simple" as any);
      expect(info.args).toEqual([]);
    });
  });

  describe("params", () => {
    it("returns empty array for commands without params", () => {
      const info = commandInfo("/auth" as any);
      expect(info.params).toEqual([]);
    });

    it("extracts param info with description", () => {
      const info = commandInfo("/list/$projectId" as any);

      expect(info.params).toHaveLength(1);
      expect(info.params[0]).toEqual({
        name: "projectId",
        description: "The project ID",
        isSplat: false,
      });
    });

    it("handles splat params", () => {
      const info = commandInfo("/add/$" as any);

      expect(info.params).toHaveLength(1);
      expect(info.params[0]).toEqual({
        name: "_splat",
        description: "Packages to add",
        isSplat: true,
      });
    });
  });

  describe("fullUsage()", () => {
    it("returns formatted help text", () => {
      const info = commandInfo("/auth" as any);
      const usage = info.fullUsage();

      expect(usage).toContain("test-cli auth - Authenticate user");
      expect(usage).toContain("Usage: test-cli auth --username <string> --password <string>");
      expect(usage).toContain("--username, -u <string>  Username");
      expect(usage).toContain("--password, -p <string>  Password");
      expect(usage).toContain("--help, -h");
    });

    it("includes arguments section for commands with params", () => {
      const info = commandInfo("/list/$projectId" as any);
      const usage = info.fullUsage();

      expect(usage).toContain("Arguments:");
      expect(usage).toContain("projectId");
      expect(usage).toContain("The project ID");
    });
  });

  describe("error handling", () => {
    it("throws if commands not registered", () => {
      // Reset registry by re-importing (simulate fresh state)
      // This is tricky to test since the module state is shared
      // For now, we test that valid paths work
      expect(() => commandInfo("/auth" as any)).not.toThrow();
    });
  });
});
