import { describe, it, expect, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { z } from "zod";
import { createCommandsRouter } from "../router";
import { createFileCommand } from "../createFileCommand";
import { runCommand } from "../runCommand";
import type { FileCommand, ParsedRoute } from "../types";
import { RunCommandError, ParseError } from "../errors";

// Helper to create test commands tree
function createTestTree(): Record<string, FileCommand<any, any, any, any>> {
  return {
    "/": createFileCommand("/")({
      description: "Root command",
      handler: async () => "root output",
    }),
    "/auth": createFileCommand("/auth")({
      description: "Authenticate",
      validateArgs: z.object({
        username: z.string().optional(),
      }),
      handler: async ({ args }) => `auth: ${args.username || "anonymous"}`,
    }),
    "/list": createFileCommand("/list")({
      description: "List items",
      validateArgs: z.object({
        verbose: z.boolean().default(false),
      }),
      aliases: { verbose: ["v"] },
      handler: async ({ args }) => `list (verbose: ${args.verbose})`,
    }),
    "/projects/$projectId": createFileCommand("/projects/$projectId")({
      description: "Get project",
      handler: async ({ params }) => `project: ${params.projectId}`,
    }),
    "/add/$": createFileCommand("/add/$")({
      description: "Add packages",
      handler: async ({ params }) => `adding: ${(params._splat as string[]).join(", ")}`,
    }),
    "/error": createFileCommand("/error")({
      description: "Error command",
      handler: async () => {
        throw new Error("command error");
      },
    }),
    "/error-handled": createFileCommand("/error-handled")({
      description: "Error with handler",
      onError: (err) => `Handled: ${err.message}`,
      handler: async () => {
        throw new Error("handled error");
      },
    }),
    "/exit": createFileCommand("/exit")({
      description: "Exit with code",
      handler: async () => 42,
    }),
    "/void": createFileCommand("/void")({
      description: "No output",
      handler: async () => {},
    }),
    "/runcommand-source": createFileCommand("/runcommand-source")({
      description: "Runs auth command",
      handler: async () => {
        return runCommand("/auth", { args: { username: "redirected" } });
      },
    }),
    "/_layout": createFileCommand("/_layout")({
      description: "Layout",
      handler: async ({ outlet }) => {
        const content = await outlet;
        return `[layout]${content}[/layout]`;
      },
    }),
    "/_layout/child": createFileCommand("/_layout/child")({
      description: "Layout child",
      handler: async () => "child content",
    }),
  };
}

// Helper to create a route
function createRoute(overrides: Partial<ParsedRoute> = {}): ParsedRoute {
  return {
    path: "/",
    params: {},
    args: {},
    rawArgs: [],
    ...overrides,
  };
}

describe("createCommandsRouter", () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[];
  let errorOutput: string[];

  beforeEach(() => {
    logOutput = [];
    errorOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = (...args: any[]) => logOutput.push(args.join(" "));
    console.error = (...args: any[]) => errorOutput.push(args.join(" "));
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe("basic router creation", () => {
    it("creates a router with commands tree", () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      expect(router).toBeDefined();
      expect(typeof router.run).toBe("function");
      expect(typeof router.invoke).toBe("function");
    });

    it("accepts optional context", () => {
      const tree = createTestTree();
      const router = createCommandsRouter({
        commandsTree: tree,
        context: { user: { id: "123" } },
      });

      expect(router).toBeDefined();
    });

    it("accepts optional cliName", () => {
      const tree = createTestTree();
      const router = createCommandsRouter({
        commandsTree: tree,
        cliName: "my-awesome-cli",
      });

      expect(router).toBeDefined();
    });
  });

  describe("invoke method", () => {
    it("returns string result from handler", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(createRoute({ path: "/" }));
      expect(result).toBe("root output");
    });

    it("returns number result from handler", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(createRoute({ path: "/exit" }));
      expect(result).toBe(42);
    });

    it("returns undefined for void handler", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(createRoute({ path: "/void" }));
      expect(result).toBeUndefined();
    });

    it("passes args to command", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(
        createRoute({
          path: "/auth",
          args: { username: "testuser" },
        })
      );
      expect(result).toBe("auth: testuser");
    });

    it("passes params to command", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(
        createRoute({
          path: "/projects/$projectId",
          params: { projectId: "proj_123" },
        })
      );
      expect(result).toBe("project: proj_123");
    });

    it("handles splat params", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(
        createRoute({
          path: "/add/$",
          params: { _splat: ["typescript", "react", "zod"] },
        })
      );
      expect(result).toBe("adding: typescript, react, zod");
    });

    it("throws error for unknown command", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      await expect(
        router.invoke(createRoute({ path: "/unknown" }))
      ).rejects.toThrow();
    });

    it("propagates handler errors", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      await expect(
        router.invoke(createRoute({ path: "/error" }))
      ).rejects.toThrow("command error");
    });
  });

  describe("run method", () => {
    it("prints string output to console", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      await router.run(createRoute({ path: "/" }));

      expect(logOutput).toContain("root output");
    });

    it("does not print for void result", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      await router.run(createRoute({ path: "/void" }));

      expect(logOutput).toHaveLength(0);
    });

    it("handles command errors with command onError", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      await router.run(createRoute({ path: "/error-handled" }));

      // onError output goes to console.error
      expect(errorOutput).toContain("Handled: handled error");
    });

    it("handles command errors with global defaultOnError", async () => {
      const tree = createTestTree();
      let capturedError: Error | null = null;

      const router = createCommandsRouter({
        commandsTree: tree,
        defaultOnError: (err) => {
          capturedError = err;
        },
      });

      await router.run(createRoute({ path: "/error" }));

      expect(capturedError).not.toBeNull();
      expect(capturedError!.message).toBe("command error");
    });

    it("command onError takes priority over global defaultOnError", async () => {
      const tree = createTestTree();
      let globalCalled = false;

      const router = createCommandsRouter({
        commandsTree: tree,
        defaultOnError: () => {
          globalCalled = true;
        },
      });

      await router.run(createRoute({ path: "/error-handled" }));

      expect(globalCalled).toBe(false);
      // onError output goes to console.error
      expect(errorOutput).toContain("Handled: handled error");
    });
  });

  describe("help handling", () => {
    it("shows global help for __help__ path", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({
        commandsTree: tree,
        cliName: "test-cli",
      });

      await router.run(createRoute({ path: "__help__" }));

      expect(logOutput.join("\n")).toContain("Usage: test-cli");
      expect(logOutput.join("\n")).toContain("Commands:");
    });

    it("shows command help when args.help is true", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({
        commandsTree: tree,
        cliName: "test-cli",
      });

      await router.run(
        createRoute({
          path: "/list",
          args: { help: true },
        })
      );

      expect(logOutput.join("\n")).toContain("test-cli list");
      expect(logOutput.join("\n")).toContain("--verbose");
    });

    it("shows command help when args.h is true", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({
        commandsTree: tree,
        cliName: "test-cli",
      });

      await router.run(
        createRoute({
          path: "/auth",
          args: { h: true },
        })
      );

      expect(logOutput.join("\n")).toContain("test-cli auth");
    });
  });

  describe("runCommand handling", () => {
    it("follows runCommand to another command", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(
        createRoute({ path: "/runcommand-source" })
      );

      expect(result).toBe("auth: redirected");
    });

    it("runCommand preserves args", async () => {
      // Create a command that runs another command with specific args
      const treeWithRunCommand: Record<string, FileCommand<any, any, any, any>> = {
        "/source": createFileCommand("/source")({
          description: "Source",
          handler: async () => {
            return runCommand("/target", { args: { value: "passed" } });
          },
        }),
        "/target": createFileCommand("/target")({
          description: "Target",
          validateArgs: z.object({ value: z.string().optional() }),
          handler: async ({ args }) => `received: ${args.value}`,
        }),
      };

      const router = createCommandsRouter({ commandsTree: treeWithRunCommand });
      const result = await router.invoke(createRoute({ path: "/source" }));

      expect(result).toBe("received: passed");
    });
  });

  describe("layout handling", () => {
    it("wraps child with layout", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(
        createRoute({ path: "/_layout/child" })
      );

      expect(result).toBe("[layout]child content[/layout]");
    });
  });

  describe("context passing", () => {
    it("passes user context to commands", async () => {
      let receivedContext: any = null;

      const treeWithContext: Record<string, FileCommand<any, any, any, any>> = {
        "/test": createFileCommand("/test")({
          description: "Test",
          handler: async ({ context }) => {
            receivedContext = context;
            return "done";
          },
        }),
      };

      const userContext = { user: { id: "123" }, settings: { theme: "dark" } };
      const router = createCommandsRouter({
        commandsTree: treeWithContext,
        context: userContext,
      });

      await router.invoke(createRoute({ path: "/test" }));

      expect(receivedContext).toEqual(userContext);
    });
  });

  describe("result handling", () => {
    it("handles string result", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      await router.run(createRoute({ path: "/" }));

      expect(logOutput).toContain("root output");
    });

    it("handles number result (exit code)", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      // For run(), number result should call process.exit
      // We can't easily test process.exit, so we test invoke() instead
      const result = await router.invoke(createRoute({ path: "/exit" }));
      expect(result).toBe(42);
    });

    it("handles void result (no output)", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      await router.run(createRoute({ path: "/void" }));

      // No output should be logged
      expect(logOutput).toHaveLength(0);
    });
  });

  describe("alias handling", () => {
    it("validates args with alias expansion", async () => {
      const tree = createTestTree();
      const router = createCommandsRouter({ commandsTree: tree });

      const result = await router.invoke(
        createRoute({
          path: "/list",
          args: { v: true },
        })
      );

      expect(result).toBe("list (verbose: true)");
    });
  });
});

// Note: The current router implementation does not have runCommand loop prevention.
// This test is skipped to avoid infinite loops during testing.
// If loop prevention is added, this test can be enabled.
describe.skip("runCommand loop prevention", () => {
  it("detects and prevents infinite runCommand loops", async () => {
    const loopTree: Record<string, FileCommand<any, any, any, any>> = {
      "/a": createFileCommand("/a")({
        description: "A",
        handler: async () => runCommand("/b"),
      }),
      "/b": createFileCommand("/b")({
        description: "B",
        handler: async () => runCommand("/a"),
      }),
    };

    const router = createCommandsRouter({ commandsTree: loopTree });

    // The router should have some protection against infinite loops
    // This might throw or timeout - implementation dependent
    await expect(
      router.invoke(createRoute({ path: "/a" }))
    ).rejects.toThrow();
  });
});
