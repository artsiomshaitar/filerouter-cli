import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { z } from "zod";
import { createFileCommand } from "../createFileCommand";
import { ParseError } from "../errors";
import { createParseRoute, type RouteTable } from "../parseRoute";
import { createCommandsRouter } from "../router";
import { runCommand } from "../runCommand";
import type { FileCommand, ParsedRoute } from "../types";

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

// Helper to create test route table matching the test tree
function createTestRouteTable(): RouteTable {
  return {
    staticRoutes: {
      auth: "/auth",
      list: "/list",
      error: "/error",
      "error-handled": "/error-handled",
      exit: "/exit",
      void: "/void",
      "runcommand-source": "/runcommand-source",
      child: "/_layout/child",
    },
    dynamicRoutes: [
      {
        segments: ["projects", "$projectId"],
        path: "/projects/$projectId",
        paramIndices: { projectId: 1 },
      },
    ],
    splatRoutes: [{ parentSegments: ["add"], path: "/add/$" }],
    availableCommands: [
      "auth",
      "list",
      "projects <projectId>",
      "add <items...>",
      "error",
      "exit",
      "void",
    ],
  };
}

// Helper to create a test router
function createTestRouter(
  options: { context?: any; cliName?: string; defaultOnError?: (err: Error) => void } = {},
) {
  const tree = createTestTree();
  const routeTable = createTestRouteTable();
  const parseRoute = createParseRoute(tree, routeTable);
  return createCommandsRouter({
    commandsTree: tree,
    parseRoute,
    ...options,
  });
}

// Helper to create a route for invoke()
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
    it("creates a router with commands tree and parseRoute", () => {
      const router = createTestRouter();

      expect(router).toBeDefined();
      expect(typeof router.run).toBe("function");
      expect(typeof router.invoke).toBe("function");
    });

    it("accepts optional context", () => {
      const router = createTestRouter({ context: { user: { id: "123" } } });
      expect(router).toBeDefined();
    });

    it("accepts optional cliName", () => {
      const router = createTestRouter({ cliName: "my-awesome-cli" });
      expect(router).toBeDefined();
    });
  });

  describe("invoke method", () => {
    it("returns string result from handler", async () => {
      const router = createTestRouter();
      const result = await router.invoke(createRoute({ path: "/" }));
      expect(result).toBe("root output");
    });

    it("returns number result from handler", async () => {
      const router = createTestRouter();
      const result = await router.invoke(createRoute({ path: "/exit" }));
      expect(result).toBe(42);
    });

    it("returns undefined for void handler", async () => {
      const router = createTestRouter();
      const result = await router.invoke(createRoute({ path: "/void" }));
      expect(result).toBeUndefined();
    });

    it("passes args to command", async () => {
      const router = createTestRouter();
      const result = await router.invoke(
        createRoute({
          path: "/auth",
          args: { username: "testuser" },
        }),
      );
      expect(result).toBe("auth: testuser");
    });

    it("passes params to command", async () => {
      const router = createTestRouter();
      const result = await router.invoke(
        createRoute({
          path: "/projects/$projectId",
          params: { projectId: "proj_123" },
        }),
      );
      expect(result).toBe("project: proj_123");
    });

    it("handles splat params", async () => {
      const router = createTestRouter();
      const result = await router.invoke(
        createRoute({
          path: "/add/$",
          params: { _splat: ["typescript", "react", "zod"] },
        }),
      );
      expect(result).toBe("adding: typescript, react, zod");
    });

    it("throws error for unknown command", async () => {
      const router = createTestRouter();
      await expect(router.invoke(createRoute({ path: "/unknown" }))).rejects.toThrow();
    });

    it("propagates handler errors", async () => {
      const router = createTestRouter();
      await expect(router.invoke(createRoute({ path: "/error" }))).rejects.toThrow("command error");
    });
  });

  describe("run method", () => {
    it("prints string output to console", async () => {
      const router = createTestRouter();
      await router.run(["node", "cli"]);
      expect(logOutput).toContain("root output");
    });

    it("does not print for void result", async () => {
      const router = createTestRouter();
      await router.run(["node", "cli", "void"]);
      expect(logOutput).toHaveLength(0);
    });

    it("handles command errors with command onError", async () => {
      const router = createTestRouter();
      await router.run(["node", "cli", "error-handled"]);
      // onError output goes to console.error
      expect(errorOutput).toContain("Handled: handled error");
    });

    it("handles command errors with global defaultOnError", async () => {
      let capturedError: Error | null = null;
      const router = createTestRouter({
        defaultOnError: (err) => {
          capturedError = err;
        },
      });
      await router.run(["node", "cli", "error"]);
      expect(capturedError).not.toBeNull();
      expect(capturedError!.message).toBe("command error");
    });

    it("command onError takes priority over global defaultOnError", async () => {
      let globalCalled = false;
      const router = createTestRouter({
        defaultOnError: () => {
          globalCalled = true;
        },
      });
      await router.run(["node", "cli", "error-handled"]);
      expect(globalCalled).toBe(false);
      // onError output goes to console.error
      expect(errorOutput).toContain("Handled: handled error");
    });
  });

  describe("help handling", () => {
    it("shows global help for --help flag", async () => {
      const router = createTestRouter({ cliName: "test-cli" });
      await router.run(["node", "cli", "--help"]);
      expect(logOutput.join("\n")).toContain("Usage: test-cli");
      expect(logOutput.join("\n")).toContain("Commands:");
    });

    it("shows command help when --help flag is passed", async () => {
      const router = createTestRouter({ cliName: "test-cli" });
      await router.run(["node", "cli", "list", "--help"]);
      expect(logOutput.join("\n")).toContain("test-cli list");
      expect(logOutput.join("\n")).toContain("--verbose");
    });

    it("shows command help when -h flag is passed", async () => {
      const router = createTestRouter({ cliName: "test-cli" });
      await router.run(["node", "cli", "auth", "-h"]);
      expect(logOutput.join("\n")).toContain("test-cli auth");
    });
  });

  describe("runCommand handling", () => {
    it("follows runCommand to another command", async () => {
      const router = createTestRouter();
      const result = await router.invoke(createRoute({ path: "/runcommand-source" }));
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

      const routeTable: RouteTable = {
        staticRoutes: { source: "/source", target: "/target" },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["source", "target"],
      };

      const router = createCommandsRouter({
        commandsTree: treeWithRunCommand,
        parseRoute: createParseRoute(treeWithRunCommand, routeTable),
      });
      const result = await router.invoke(createRoute({ path: "/source" }));

      expect(result).toBe("received: passed");
    });
  });

  describe("layout handling", () => {
    it("wraps child with layout", async () => {
      const router = createTestRouter();
      const result = await router.invoke(createRoute({ path: "/_layout/child" }));

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

      const routeTable: RouteTable = {
        staticRoutes: { test: "/test" },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["test"],
      };

      const userContext = { user: { id: "123" }, settings: { theme: "dark" } };
      const router = createCommandsRouter({
        commandsTree: treeWithContext,
        parseRoute: createParseRoute(treeWithContext, routeTable),
        context: userContext,
      });

      await router.invoke(createRoute({ path: "/test" }));

      expect(receivedContext).toEqual(userContext);
    });
  });

  describe("result handling", () => {
    it("handles string result", async () => {
      const router = createTestRouter();
      await router.run(["node", "cli"]);
      expect(logOutput).toContain("root output");
    });

    it("handles number result (exit code) via invoke", async () => {
      const router = createTestRouter();
      const result = await router.invoke(createRoute({ path: "/exit" }));
      expect(result).toBe(42);
    });

    it("does not print or exit for number result via run", async () => {
      const router = createTestRouter();
      await router.run(["node", "cli", "exit"]);
      // Number results should not be printed
      expect(logOutput).toHaveLength(0);
    });

    it("handles void result (no output)", async () => {
      const router = createTestRouter();
      await router.run(["node", "cli", "void"]);
      expect(logOutput).toHaveLength(0);
    });

    it("re-throws parse errors from run() instead of calling process.exit", async () => {
      const router = createTestRouter();
      await expect(router.run(["node", "cli", "nonexistent-command"])).rejects.toThrow(ParseError);
      expect(errorOutput.join(" ")).toContain("Unknown command");
    });

    it("re-throws unhandled command errors from run()", async () => {
      const router = createTestRouter();
      await expect(router.run(["node", "cli", "error"])).rejects.toThrow("command error");
      expect(errorOutput.join(" ")).toContain("Unexpected error");
    });
  });

  describe("alias handling", () => {
    it("validates args with alias expansion", async () => {
      const router = createTestRouter();
      const result = await router.invoke(
        createRoute({
          path: "/list",
          args: { v: true },
        }),
      );

      expect(result).toBe("list (verbose: true)");
    });
  });
});

describe("runCommand loop prevention", () => {
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

    const routeTable: RouteTable = {
      staticRoutes: { a: "/a", b: "/b" },
      dynamicRoutes: [],
      splatRoutes: [],
      availableCommands: ["a", "b"],
    };

    const router = createCommandsRouter({
      commandsTree: loopTree,
      parseRoute: createParseRoute(loopTree, routeTable),
    });

    await expect(router.invoke(createRoute({ path: "/a" }))).rejects.toThrow(/cycle detected/);
  });

  it("detects self-redirect loops", async () => {
    const loopTree: Record<string, FileCommand<any, any, any, any>> = {
      "/self": createFileCommand("/self")({
        description: "Self",
        handler: async () => runCommand("/self" as any),
      }),
    };

    const routeTable: RouteTable = {
      staticRoutes: { self: "/self" },
      dynamicRoutes: [],
      splatRoutes: [],
      availableCommands: ["self"],
    };

    const router = createCommandsRouter({
      commandsTree: loopTree,
      parseRoute: createParseRoute(loopTree, routeTable),
    });

    await expect(router.invoke(createRoute({ path: "/self" }))).rejects.toThrow(/cycle detected/);
  });

  it("allows valid redirect chains (A -> B -> C)", async () => {
    const chainTree: Record<string, FileCommand<any, any, any, any>> = {
      "/a": createFileCommand("/a")({
        description: "A",
        handler: async () => runCommand("/b"),
      }),
      "/b": createFileCommand("/b")({
        description: "B",
        handler: async () => runCommand("/c"),
      }),
      "/c": createFileCommand("/c")({
        description: "C",
        handler: async () => "reached C",
      }),
    };

    const routeTable: RouteTable = {
      staticRoutes: { a: "/a", b: "/b", c: "/c" },
      dynamicRoutes: [],
      splatRoutes: [],
      availableCommands: ["a", "b", "c"],
    };

    const router = createCommandsRouter({
      commandsTree: chainTree,
      parseRoute: createParseRoute(chainTree, routeTable),
    });

    const result = await router.invoke(createRoute({ path: "/a" }));
    expect(result).toBe("reached C");
  });
});
