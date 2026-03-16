import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { scanCommands } from "../../generator/scanner";
import { generateCommandsTree } from "../../generator/codegen";

/**
 * Integration tests for the full CLI flow:
 * 1. Create command files in a temp directory
 * 2. Run the scanner to detect commands
 * 3. Generate the commandsTree.gen.ts
 * 4. Dynamically import and test the generated code
 * 5. Test route matching, command execution, help generation
 */

describe("CLI Integration", () => {
  let tempDir: string;
  let commandsDir: string;
  let genFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "filerouter-integration-"));
    commandsDir = join(tempDir, "commands");
    genFile = join(tempDir, "commandsTree.gen.ts");
    await mkdir(commandsDir, { recursive: true });
    
    // Create required __root.ts file (following TanStack Router's naming convention)
    await writeFile(
      join(commandsDir, "__root.ts"),
      `import { createRootCommand } from "filerouter-cli";
export const RootCommand = createRootCommand()({ description: "Test CLI" });`
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // Helper to create a command file
  async function createCommand(relativePath: string, content: string) {
    const fullPath = join(commandsDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content);
  }

  // Helper to generate and import the commands tree
  async function generateAndImport() {
    const { commands } = await scanCommands(commandsDir);
    const code = generateCommandsTree(commands, {
      commandsDirectory: commandsDir,
      generatedFile: genFile,
    });
    await writeFile(genFile, code);
    
    // Import dynamically - need to add random query to bust cache
    const cacheBuster = `?t=${Date.now()}-${Math.random()}`;
    return await import(`${genFile}${cacheBuster}`);
  }

  describe("full flow with static routes", () => {
    it("scans, generates, and matches static route", async () => {
      await createCommand(
        "auth.ts",
        `
        export const Command = {
          __path: "/auth",
          config: {
            description: "Authenticate",
            handler: async () => "authenticated",
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(1);
      expect(commands[0].routePath).toBe("/auth");
      expect(commands[0].isLayout).toBe(false);
    });

    it("generates commandsTree with correct structure", async () => {
      await createCommand(
        "auth.ts",
        `
        export const Command = {
          __path: "/auth",
          config: {
            description: "Authenticate",
            handler: async () => "authenticated",
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);
      const code = generateCommandsTree(commands, {
        commandsDirectory: commandsDir,
        generatedFile: genFile,
      });

      expect(code).toContain('"/auth": AuthCommand');
      expect(code).toContain("export const parseRoute = createParseRoute");
      expect(code).toContain('registerCommands(commandsTree)');
    });
  });

  describe("full flow with dynamic routes", () => {
    it("handles dynamic parameter route", async () => {
      await createCommand(
        "projects/$projectId.ts",
        `
        export const Command = {
          __path: "/projects/$projectId",
          config: {
            description: "Get project",
            handler: async ({ params }) => \`project: \${params.projectId}\`,
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(1);
      expect(commands[0].routePath).toBe("/projects/$projectId");
      expect(commands[0].hasParams).toBe(true);
      expect(commands[0].paramNames).toEqual(["projectId"]);
    });

    it("generates code with dynamic route matching", async () => {
      await createCommand(
        "users/$userId.ts",
        `
        export const Command = {
          __path: "/users/$userId",
          config: {
            description: "Get user",
            handler: async ({ params }) => params.userId,
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);
      const code = generateCommandsTree(commands, {
        commandsDirectory: commandsDir,
        generatedFile: genFile,
      });

      expect(code).toContain("dynamicRoutes");
      expect(code).toContain('segments: ["users", "$userId"]');
      expect(code).toContain('paramIndices: { userId: 1 }');
    });
  });

  describe("full flow with splat routes", () => {
    it("handles splat route", async () => {
      await createCommand(
        "add/$.ts",
        `
        export const Command = {
          __path: "/add/$",
          config: {
            description: "Add packages",
            handler: async ({ params }) => params._splat.join(", "),
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(1);
      expect(commands[0].routePath).toBe("/add/$");
      expect(commands[0].isSplat).toBe(true);
      expect(commands[0].paramNames).toEqual(["_splat"]);
    });

    it("generates code with splat route matching (lowest priority)", async () => {
      await createCommand(
        "add/$.ts",
        `
        export const Command = {
          __path: "/add/$",
          config: {
            description: "Add",
            handler: async () => "add",
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);
      const code = generateCommandsTree(commands, {
        commandsDirectory: commandsDir,
        generatedFile: genFile,
      });

      expect(code).toContain("splatRoutes");
      expect(code).toContain('parentSegments: ["add"]');
      expect(code).toContain("_splat");
    });

    it("throws error for splat with children", async () => {
      await createCommand("add/$.ts", "export const Command = {};");
      await createCommand("add/$/invalid.ts", "export const Command = {};");

      await expect(scanCommands(commandsDir)).rejects.toThrow(/cannot have child routes/);
    });
  });

  describe("full flow with pathless layouts", () => {
    it("handles pathless layout", async () => {
      await createCommand(
        "_auth/route.ts",
        `
        export const Command = {
          __path: "/_auth",
          config: {
            description: "Auth layout",
            handler: async ({ outlet }) => {
              const content = await outlet;
              return \`[auth]\${content}[/auth]\`;
            },
          },
        };
      `
      );

      await createCommand(
        "_auth/protected.ts",
        `
        export const Command = {
          __path: "/_auth/protected",
          config: {
            description: "Protected",
            handler: async () => "secret",
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(2);

      const layout = commands.find((c) => c.routePath === "/_auth");
      expect(layout?.isLayout).toBe(true);
      expect(layout?.isPathless).toBe(true);

      const child = commands.find((c) => c.routePath === "/_auth/protected");
      expect(child?.isLayout).toBe(false);
      expect(child?.isPathless).toBe(true);
    });

    it("generates pathless child accessible without prefix", async () => {
      await createCommand(
        "_auth/protected.ts",
        `
        export const Command = {
          __path: "/_auth/protected",
          config: {
            description: "Protected",
            handler: async () => "protected",
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);
      const code = generateCommandsTree(commands, {
        commandsDirectory: commandsDir,
        generatedFile: genFile,
      });

      // The CLI command should be "protected", not "_auth/protected"
      expect(code).toContain('"protected"');
    });
  });

  describe("full flow with mixed route types", () => {
    it("handles all route types together", async () => {
      // Root
      await createCommand(
        "index.ts",
        `
        export const Command = {
          __path: "/",
          config: { description: "Root", handler: async () => "root" },
        };
      `
      );

      // Static
      await createCommand(
        "auth.ts",
        `
        export const Command = {
          __path: "/auth",
          config: { description: "Auth", handler: async () => "auth" },
        };
      `
      );

      // Dynamic
      await createCommand(
        "users/$userId.ts",
        `
        export const Command = {
          __path: "/users/$userId",
          config: { description: "User", handler: async ({ params }) => params.userId },
        };
      `
      );

      // Splat
      await createCommand(
        "install/$.ts",
        `
        export const Command = {
          __path: "/install/$",
          config: { description: "Install", handler: async ({ params }) => params._splat },
        };
      `
      );

      // Layout
      await createCommand(
        "_admin/route.ts",
        `
        export const Command = {
          __path: "/_admin",
          config: { description: "Admin layout", handler: async ({ outlet }) => outlet },
        };
      `
      );

      // Layout child
      await createCommand(
        "_admin/dashboard.ts",
        `
        export const Command = {
          __path: "/_admin/dashboard",
          config: { description: "Dashboard", handler: async () => "dashboard" },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands.length).toBeGreaterThanOrEqual(6);

      // Generate code and verify it includes all types
      const code = generateCommandsTree(commands, {
        commandsDirectory: commandsDir,
        generatedFile: genFile,
      });

      // Verify all route types in generated code
      // "/" is IndexCommand (not RootCommand) to avoid naming conflict with RootCommand from __root.ts
      expect(code).toContain('"/": IndexCommand');
      expect(code).toContain('"/auth": AuthCommand');
      expect(code).toContain('"/users/$userId": UsersUserIdCommand');
      expect(code).toContain('"/install/$": InstallSplatCommand');
      expect(code).toContain('"/_admin": LayoutAdminCommand');
      expect(code).toContain('"/_admin/dashboard": LayoutAdminDashboardCommand');
    });
  });

  describe("route matching priority", () => {
    it("generates code with correct priority order", async () => {
      // Static route
      await createCommand(
        "list.ts",
        `
        export const Command = {
          __path: "/list",
          config: { description: "List", handler: async () => "list" },
        };
      `
      );

      // Dynamic route
      await createCommand(
        "list/$id.ts",
        `
        export const Command = {
          __path: "/list/$id",
          config: { description: "List item", handler: async () => "item" },
        };
      `
      );

      // Splat route
      await createCommand(
        "catch/$.ts",
        `
        export const Command = {
          __path: "/catch/$",
          config: { description: "Catch all", handler: async () => "catch" },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);
      const code = generateCommandsTree(commands, {
        commandsDirectory: commandsDir,
        generatedFile: genFile,
      });

      // Verify order in generated code:
      // 1. Static routes first
      const staticIndex = code.indexOf("staticRoutes");
      // 2. Dynamic routes second
      const dynamicIndex = code.indexOf("dynamicRoutes");
      // 3. Splat routes last
      const splatIndex = code.indexOf("splatRoutes");

      expect(staticIndex).toBeLessThan(dynamicIndex);
      expect(dynamicIndex).toBeLessThan(splatIndex);
    });
  });

  describe("ignore patterns", () => {
    it("ignores test files", async () => {
      await createCommand(
        "auth.ts",
        `export const Command = { __path: "/auth", config: { description: "", handler: async () => {} } };`
      );
      await createCommand(
        "auth.test.ts",
        `// This should be ignored`
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(1);
      expect(commands[0].filePath).toBe("auth.ts");
    });

    it("ignores spec files", async () => {
      await createCommand(
        "list.ts",
        `export const Command = { __path: "/list", config: { description: "", handler: async () => {} } };`
      );
      await createCommand(
        "list.spec.ts",
        `// This should be ignored`
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(1);
    });

    it("ignores .d.ts files", async () => {
      await createCommand(
        "types.ts",
        `export const Command = { __path: "/types", config: { description: "", handler: async () => {} } };`
      );
      await createCommand(
        "types.d.ts",
        `// Type declarations`
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(1);
    });
  });

  describe("file extensions", () => {
    it("supports all TypeScript extensions", async () => {
      await createCommand(
        "cmd1.ts",
        `export const Command = { __path: "/cmd1", config: { description: "", handler: async () => {} } };`
      );
      await createCommand(
        "cmd2.tsx",
        `export const Command = { __path: "/cmd2", config: { description: "", handler: async () => {} } };`
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(2);
      const paths = commands.map((c) => c.routePath);
      expect(paths).toContain("/cmd1");
      expect(paths).toContain("/cmd2");
    });

    it("supports JavaScript extensions", async () => {
      await createCommand(
        "cmd1.js",
        `export const Command = { __path: "/cmd1", config: { description: "", handler: async () => {} } };`
      );
      await createCommand(
        "cmd2.jsx",
        `export const Command = { __path: "/cmd2", config: { description: "", handler: async () => {} } };`
      );

      const { commands } = await scanCommands(commandsDir);

      expect(commands).toHaveLength(2);
    });
  });

  describe("help generation integration", () => {
    it("generates help with correct CLI name and commands", async () => {
      await createCommand(
        "auth.ts",
        `
        export const Command = {
          __path: "/auth",
          config: {
            description: "Authenticate user",
            handler: async () => "auth",
          },
        };
      `
      );

      await createCommand(
        "list.ts",
        `
        export const Command = {
          __path: "/list",
          config: {
            description: "List all items",
            handler: async () => "list",
          },
        };
      `
      );

      const { commands } = await scanCommands(commandsDir);
      const code = generateCommandsTree(commands, {
        commandsDirectory: commandsDir,
        generatedFile: genFile,
      });

      // CLI name is determined at runtime, not in generated code
      expect(code).toContain('registerCommands(commandsTree)');
      // Available commands are in the routeTable
      expect(code).toContain("availableCommands:");
      expect(code).toContain('"auth"');
      expect(code).toContain('"list"');
    });
  });
});
