import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createFileCommand } from "../createFileCommand";
import {
  extractFieldsFromZodSchema,
  generateCommandHelp,
  generateGlobalHelp,
  hasHelpFlag,
} from "../help";
import type { FileCommand } from "../types";

describe("generateCommandHelp", () => {
  it("generates help for basic command", () => {
    const command = createFileCommand("/test")({
      description: "A test command",
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "my-cli", "/test");

    expect(help).toContain("my-cli test");
    expect(help).toContain("A test command");
    expect(help).toContain("Usage:");
    expect(help).toContain("--help, -h");
  });

  it("generates help with required args", () => {
    const command = createFileCommand("/test")({
      description: "Test",
      validateArgs: z.object({
        name: z.string().describe("Your name"),
      }),
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/test");

    expect(help).toContain("--name");
    expect(help).toContain("Your name");
  });

  it("generates help with optional args", () => {
    const command = createFileCommand("/test")({
      description: "Test",
      validateArgs: z.object({
        verbose: z.boolean().optional().describe("Enable verbose output"),
      }),
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/test");

    expect(help).toContain("--verbose");
    expect(help).toContain("Enable verbose output");
  });

  it("generates help with default values", () => {
    const command = createFileCommand("/test")({
      description: "Test",
      validateArgs: z.object({
        count: z.number().default(10).describe("Number of items"),
      }),
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/test");

    expect(help).toContain("--count");
    expect(help).toContain("default: 10");
  });

  it("generates help with boolean flags", () => {
    const command = createFileCommand("/test")({
      description: "Test",
      validateArgs: z.object({
        verbose: z.boolean().default(false).describe("Verbose mode"),
        force: z.boolean().default(false).describe("Force operation"),
      }),
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/test");

    expect(help).toContain("--verbose");
    expect(help).toContain("--force");
    expect(help).toContain("default: false");
  });

  it("generates help with single param", () => {
    const command = createFileCommand("/projects/$projectId")({
      description: "Get project",
      paramsDescription: {
        projectId: "The project ID",
      },
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/projects/$projectId");

    expect(help).toContain("<projectId>");
    expect(help).toContain("The project ID");
    expect(help).toContain("Arguments:");
    expect(help).toContain("required");
  });

  it("generates help with multiple params", () => {
    const command = createFileCommand("/users/$userId/posts/$postId")({
      description: "Get post",
      paramsDescription: {
        userId: "User identifier",
        postId: "Post identifier",
      },
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/users/$userId/posts/$postId");

    expect(help).toContain("<userId>");
    expect(help).toContain("User identifier");
    expect(help).toContain("<postId>");
    expect(help).toContain("Post identifier");
  });

  it("generates help with splat param", () => {
    const command = createFileCommand("/add/$")({
      description: "Add packages",
      paramsDescription: {
        _splat: "Packages to install",
      },
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/add/$");

    expect(help).toContain("<items...>");
    expect(help).toContain("Packages to install");
    expect(help).toContain("optional");
    expect(help).toContain("variadic");
  });

  it("shows aliases in help", () => {
    const command = createFileCommand("/test")({
      description: "Test",
      validateArgs: z.object({
        verbose: z.boolean().default(false).describe("Verbose"),
        dev: z.boolean().default(false).describe("Dev mode"),
      }),
      aliases: {
        verbose: ["v"],
        dev: ["D", "d"],
      },
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/test", {
      verbose: ["v"],
      dev: ["D", "d"],
    });

    expect(help).toContain("--verbose, -v");
    expect(help).toContain("--dev, -D, -d");
  });

  it("uses validateParams.describe() for param descriptions", () => {
    const command = createFileCommand("/projects/$projectId")({
      description: "Get project",
      validateParams: z.object({
        projectId: z.string().describe("Project identifier from validateParams"),
      }),
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/projects/$projectId");

    expect(help).toContain("Project identifier from validateParams");
  });

  it("prefers validateParams.describe() over paramsDescription", () => {
    const command = createFileCommand("/projects/$projectId")({
      description: "Get project",
      validateParams: z.object({
        projectId: z.string().describe("From validateParams"),
      }),
      paramsDescription: {
        projectId: "From paramsDescription",
      },
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/projects/$projectId");

    // validateParams.describe() should take priority
    expect(help).toContain("From validateParams");
  });

  it("uses param name when no description provided", () => {
    const command = createFileCommand("/projects/$projectId")({
      description: "Get project",
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/projects/$projectId");

    // Should show the param name without description
    expect(help).toContain("projectId");
  });

  it("handles pathless layouts in usage", () => {
    const command = createFileCommand("/_auth/protected")({
      description: "Protected command",
      handler: async () => {},
    });

    const help = generateCommandHelp(command, "cli", "/_auth/protected");

    // Should show "protected" without "_auth"
    expect(help).toContain("cli protected");
    expect(help).not.toContain("_auth");
  });
});

describe("generateGlobalHelp", () => {
  const createMockTree = (): Record<string, FileCommand<any, any, any, any>> => ({
    "/": createFileCommand("/")({
      description: "Root command",
      handler: async () => {},
    }),
    "/auth": createFileCommand("/auth")({
      description: "Authenticate user",
      handler: async () => {},
    }),
    "/list": createFileCommand("/list")({
      description: "List all items",
      handler: async () => {},
    }),
    "/list/$projectId": createFileCommand("/list/$projectId")({
      description: "Get project details",
      handler: async () => {},
    }),
    "/add/$": createFileCommand("/add/$")({
      description: "Add packages",
      handler: async () => {},
    }),
    "/_auth": createFileCommand("/_auth")({
      description: "Auth layout",
      handler: async () => {},
    }),
    "/_auth/protected": createFileCommand("/_auth/protected")({
      description: "Protected command",
      handler: async () => {},
    }),
  });

  it("lists all commands", () => {
    const tree = createMockTree();
    const help = generateGlobalHelp(tree, "my-cli");

    expect(help).toContain("Usage: my-cli <command>");
    expect(help).toContain("Commands:");
    expect(help).toContain("auth");
    expect(help).toContain("list");
  });

  it("skips layout commands", () => {
    const tree = createMockTree();
    const help = generateGlobalHelp(tree, "my-cli");

    // /_auth is a layout, should not appear as a command
    // But the pathless child _auth/protected should appear as "protected"
    expect(help).not.toContain("_auth ");
    expect(help).toContain("protected");
  });

  it("skips root command from list", () => {
    const tree = createMockTree();
    const help = generateGlobalHelp(tree, "my-cli");

    // Root "/" should not be listed as a command
    // But other commands should be
    expect(help).toContain("auth");
    expect(help).not.toMatch(/^\s+\/\s+/m);
  });

  it("sorts commands alphabetically", () => {
    const tree = createMockTree();
    const help = generateGlobalHelp(tree, "my-cli");

    const lines = help.split("\n");
    const commandLines = lines.filter((line) => line.match(/^\s{2}\S/));

    // Extract command names and check they're sorted
    const commands = commandLines.map((line) => line.trim().split(/\s+/)[0]);

    // Filter out empty and undefined
    const validCommands = commands.filter(Boolean);

    // Should be in alphabetical order
    const sorted = [...validCommands].sort();
    expect(validCommands).toEqual(sorted);
  });

  it("converts route paths to CLI commands", () => {
    const tree = createMockTree();
    const help = generateGlobalHelp(tree, "my-cli");

    // /list/$projectId should show as "list <projectId>"
    expect(help).toContain("list <projectId>");

    // /add/$ should show as "add <items...>"
    expect(help).toContain("add <items...>");

    // /_auth/protected should show as "protected"
    expect(help).toContain("protected");
  });

  it("shows command descriptions", () => {
    const tree = createMockTree();
    const help = generateGlobalHelp(tree, "my-cli");

    expect(help).toContain("Authenticate user");
    expect(help).toContain("List all items");
    expect(help).toContain("Add packages");
  });

  it("shows help hint at the end", () => {
    const tree = createMockTree();
    const help = generateGlobalHelp(tree, "my-cli");

    expect(help).toContain("Run 'my-cli <command> --help'");
  });
});

describe("hasHelpFlag", () => {
  it("returns true for --help", () => {
    expect(hasHelpFlag({ help: true })).toBe(true);
  });

  it("returns true for -h", () => {
    expect(hasHelpFlag({ h: true })).toBe(true);
  });

  it("returns true for args.help = true", () => {
    expect(hasHelpFlag({ help: true, other: "value" })).toBe(true);
  });

  it("returns true for args.h = true", () => {
    expect(hasHelpFlag({ h: true, other: "value" })).toBe(true);
  });

  it("returns false for no help flag", () => {
    expect(hasHelpFlag({ verbose: true, name: "test" })).toBe(false);
  });

  it("returns false for empty args", () => {
    expect(hasHelpFlag({})).toBe(false);
  });

  it("returns false for help = false", () => {
    expect(hasHelpFlag({ help: false })).toBe(false);
  });

  it("returns false for h = false", () => {
    expect(hasHelpFlag({ h: false })).toBe(false);
  });

  it("returns true if either help or h is true", () => {
    expect(hasHelpFlag({ help: false, h: true })).toBe(true);
    expect(hasHelpFlag({ help: true, h: false })).toBe(true);
  });
});

describe("extractFieldsFromZodSchema", () => {
  it("extracts string field", () => {
    const schema = z.object({
      name: z.string().describe("User name"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toEqual({
      name: "name",
      type: "string",
      description: "User name",
      isOptional: false,
      defaultValue: undefined,
    });
  });

  it("extracts number field", () => {
    const schema = z.object({
      count: z.number().describe("Item count"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("number");
  });

  it("extracts boolean field", () => {
    const schema = z.object({
      verbose: z.boolean().describe("Verbose mode"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("boolean");
  });

  it("extracts array field", () => {
    const schema = z.object({
      items: z.array(z.string()).describe("List of items"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("array");
  });

  it("extracts enum field with values", () => {
    const schema = z.object({
      format: z.enum(["json", "text", "csv"]).describe("Output format"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toHaveLength(1);
    expect(fields[0].type).toBe("json | text | csv");
  });

  it("extracts optional field", () => {
    const schema = z.object({
      name: z.string().optional().describe("Optional name"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields[0].isOptional).toBe(true);
  });

  it("extracts default value", () => {
    const schema = z.object({
      count: z.number().default(10).describe("Count"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields[0].defaultValue).toBe(10);
    expect(fields[0].isOptional).toBe(true); // defaults are optional
  });

  it("extracts nested optional with default", () => {
    const schema = z.object({
      verbose: z.boolean().optional().default(false).describe("Verbose"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields[0].isOptional).toBe(true);
    expect(fields[0].defaultValue).toBe(false);
  });

  it("extracts multiple fields", () => {
    const schema = z.object({
      name: z.string().describe("Name"),
      age: z.number().describe("Age"),
      active: z.boolean().default(true).describe("Active"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.name)).toEqual(["name", "age", "active"]);
  });

  it("handles schema without descriptions", () => {
    const schema = z.object({
      name: z.string(),
      count: z.number(),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toHaveLength(2);
    expect(fields[0].description).toBeUndefined();
    expect(fields[1].description).toBeUndefined();
  });

  it("returns empty array for non-object schema", () => {
    const schema = z.string();

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields).toEqual([]);
  });

  it("returns empty array for undefined schema", () => {
    const fields = extractFieldsFromZodSchema(undefined);

    expect(fields).toEqual([]);
  });

  it("handles deeply nested wrappers", () => {
    // Note: Very deeply nested wrappers may not fully unwrap to the innermost type
    // as the implementation only handles common cases (ZodDefault, ZodOptional)
    const schema = z.object({
      flag: z.boolean().optional().default(false).describe("Flag"),
    });

    const fields = extractFieldsFromZodSchema(schema);

    expect(fields[0].type).toBe("boolean");
    expect(fields[0].isOptional).toBe(true);
  });
});
