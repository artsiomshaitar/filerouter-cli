import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { executeCommand, executeWithLayouts, findLayoutChain } from "../context";
import { createFileCommand } from "../createFileCommand";
import { ParseError } from "../errors";
import type { FileCommand, Middleware, ParsedRoute } from "../types";

// Helper to create a basic route
function createRoute(overrides: Partial<ParsedRoute> = {}): ParsedRoute {
  return {
    path: "/test",
    params: {},
    args: {},
    rawArgs: [],
    ...overrides,
  };
}

describe("executeCommand", () => {
  describe("basic execution", () => {
    it("executes handler and returns result", async () => {
      const command = createFileCommand("/test")({
        description: "Test",
        handler: async () => "success",
      });

      const result = await executeCommand(command, createRoute(), {});
      expect(result).toBe("success");
    });

    it("handler receives args from route", async () => {
      let receivedArgs: any = null;

      const command = createFileCommand("/test")({
        description: "Test",
        handler: async ({ args }) => {
          receivedArgs = args;
          return "done";
        },
      });

      await executeCommand(command, createRoute({ args: { verbose: true, name: "test" } }), {});

      expect(receivedArgs).toEqual({ verbose: true, name: "test" });
    });

    it("handler receives params from route", async () => {
      let receivedParams: any = null;

      const command = createFileCommand("/projects/$projectId")({
        description: "Test",
        handler: async ({ params }) => {
          receivedParams = params;
          return "done";
        },
      });

      await executeCommand(command, createRoute({ params: { projectId: "proj_123" } }), {});

      expect(receivedParams).toEqual({ projectId: "proj_123" });
    });

    it("handler receives rawArgs from route", async () => {
      let receivedRawArgs: any = null;

      const command = createFileCommand("/test")({
        description: "Test",
        handler: async ({ rawArgs }) => {
          receivedRawArgs = rawArgs;
          return "done";
        },
      });

      await executeCommand(command, createRoute({ rawArgs: ["test", "--verbose", "value"] }), {});

      expect(receivedRawArgs).toEqual(["test", "--verbose", "value"]);
    });

    it("handler receives user context", async () => {
      let receivedContext: any = null;

      const command = createFileCommand("/test")({
        description: "Test",
        handler: async ({ context }) => {
          receivedContext = context;
          return "done";
        },
      });

      const userContext = { user: { id: "123" }, token: "abc" };
      await executeCommand(command, createRoute(), userContext);

      expect(receivedContext).toEqual(userContext);
    });

    it("handler receives shell function ($)", async () => {
      let hasShell = false;

      const command = createFileCommand("/test")({
        description: "Test",
        handler: async ({ $ }) => {
          hasShell = typeof $ === "function";
          return "done";
        },
      });

      await executeCommand(command, createRoute(), {});
      expect(hasShell).toBe(true);
    });
  });

  describe("validation", () => {
    it("validates args with schema", async () => {
      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: z.object({
          name: z.string(),
          count: z.number().default(1),
        }),
        handler: async ({ args }) => {
          return `${args.name}: ${args.count}`;
        },
      });

      const result = await executeCommand(command, createRoute({ args: { name: "test" } }), {});

      expect(result).toBe("test: 1");
    });

    it("throws on invalid args", async () => {
      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: z.object({
          name: z.string(),
        }),
        handler: async () => "done",
      });

      await expect(executeCommand(command, createRoute({ args: {} }), {})).rejects.toThrow(
        ParseError,
      );
    });

    it("validates params with schema", async () => {
      const command = createFileCommand("/projects/$projectId")({
        description: "Test",
        validateParams: z.object({
          projectId: z.string().min(3),
        }),
        handler: async ({ params }) => {
          return params.projectId;
        },
      });

      const result = await executeCommand(
        command,
        createRoute({ params: { projectId: "proj_123" } }),
        {},
      );

      expect(result).toBe("proj_123");
    });

    it("throws on invalid params", async () => {
      const command = createFileCommand("/projects/$projectId")({
        description: "Test",
        validateParams: z.object({
          projectId: z.string().min(10),
        }),
        handler: async () => "done",
      });

      await expect(
        executeCommand(command, createRoute({ params: { projectId: "abc" } }), {}),
      ).rejects.toThrow(ParseError);
    });

    it("expands aliases during args validation", async () => {
      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: z.object({
          verbose: z.boolean().default(false),
        }),
        aliases: { verbose: ["v"] },
        handler: async ({ args }) => {
          return args.verbose ? "verbose" : "quiet";
        },
      });

      const result = await executeCommand(command, createRoute({ args: { v: true } }), {});

      expect(result).toBe("verbose");
    });
  });

  describe("middleware integration", () => {
    it("executes middleware before handler", async () => {
      const order: string[] = [];

      const middleware: Middleware = async (_ctx, next) => {
        order.push("middleware");
        await next();
      };

      const command = createFileCommand("/test")({
        description: "Test",
        middleware: [middleware],
        handler: async () => {
          order.push("handler");
          return "done";
        },
      });

      await executeCommand(command, createRoute(), {});
      expect(order).toEqual(["middleware", "handler"]);
    });

    it("executes multiple middleware in order", async () => {
      const order: string[] = [];

      const mw1: Middleware = async (_ctx, next) => {
        order.push("mw1-before");
        await next();
        order.push("mw1-after");
      };

      const mw2: Middleware = async (_ctx, next) => {
        order.push("mw2-before");
        await next();
        order.push("mw2-after");
      };

      const command = createFileCommand("/test")({
        description: "Test",
        middleware: [mw1, mw2],
        handler: async () => {
          order.push("handler");
          return "done";
        },
      });

      await executeCommand(command, createRoute(), {});
      expect(order).toEqual(["mw1-before", "mw2-before", "handler", "mw2-after", "mw1-after"]);
    });
  });

  describe("handler return values", () => {
    it("returns string from handler", async () => {
      const command = createFileCommand("/test")({
        description: "Test",
        handler: async () => "output text",
      });

      const result = await executeCommand(command, createRoute(), {});
      expect(result).toBe("output text");
    });

    it("returns number from handler", async () => {
      const command = createFileCommand("/test")({
        description: "Test",
        handler: async () => 42,
      });

      const result = await executeCommand(command, createRoute(), {});
      expect(result).toBe(42);
    });

    it("returns void from handler", async () => {
      const command = createFileCommand("/test")({
        description: "Test",
        handler: async () => {},
      });

      const result = await executeCommand(command, createRoute(), {});
      expect(result).toBeUndefined();
    });
  });

  describe("splat params", () => {
    it("handles _splat as string array", async () => {
      let receivedSplat: any = null;

      const command = createFileCommand("/add/$")({
        description: "Add",
        handler: async ({ params }) => {
          receivedSplat = params._splat;
          return "done";
        },
      });

      await executeCommand(command, createRoute({ params: { _splat: ["foo", "bar", "baz"] } }), {});

      expect(receivedSplat).toEqual(["foo", "bar", "baz"]);
    });

    it("validates _splat with schema", async () => {
      const command = createFileCommand("/add/$")({
        description: "Add",
        validateParams: z.object({
          _splat: z.array(z.string()).min(1),
        }),
        handler: async ({ params }) => {
          return params._splat.join(", ");
        },
      });

      const result = await executeCommand(
        command,
        createRoute({ params: { _splat: ["typescript", "react"] } }),
        {},
      );

      expect(result).toBe("typescript, react");
    });
  });
});

describe("findLayoutChain", () => {
  // Create mock commands tree
  const createMockTree = () => {
    const authLayout = createFileCommand("/_auth")({
      description: "Auth layout",
      handler: async ({ outlet }) => {
        const result = await outlet;
        return `[auth]${result}[/auth]`;
      },
    });

    const adminLayout = createFileCommand("/_auth/_admin")({
      description: "Admin layout",
      handler: async ({ outlet }) => {
        const result = await outlet;
        return `[admin]${result}[/admin]`;
      },
    });

    const protectedCmd = createFileCommand("/_auth/protected")({
      description: "Protected",
      handler: async () => "protected content",
    });

    const adminDashboard = createFileCommand("/_auth/_admin/dashboard")({
      description: "Dashboard",
      handler: async () => "dashboard content",
    });

    const regularCmd = createFileCommand("/regular")({
      description: "Regular",
      handler: async () => "regular content",
    });

    return {
      "/_auth": authLayout,
      "/_auth/_admin": adminLayout,
      "/_auth/protected": protectedCmd,
      "/_auth/_admin/dashboard": adminDashboard,
      "/regular": regularCmd,
    } as Record<string, FileCommand<any, any, any, any>>;
  };

  it("returns empty array for path with no layouts", () => {
    const tree = createMockTree();
    const layouts = findLayoutChain("/regular", tree);
    expect(layouts).toEqual([]);
  });

  it("returns single layout for path with one pathless parent", () => {
    const tree = createMockTree();
    const layouts = findLayoutChain("/_auth/protected", tree);
    expect(layouts).toHaveLength(1);
    expect(layouts[0].__path).toBe("/_auth");
  });

  it("returns nested layouts in order (outermost first)", () => {
    const tree = createMockTree();
    const layouts = findLayoutChain("/_auth/_admin/dashboard", tree);
    expect(layouts).toHaveLength(2);
    expect(layouts[0].__path).toBe("/_auth");
    expect(layouts[1].__path).toBe("/_auth/_admin");
  });

  it("only includes pathless segments (starting with _)", () => {
    // Create a tree with mixed paths
    const mixedTree = {
      "/users": createFileCommand("/users")({
        description: "Users",
        handler: async () => "users",
      }),
      "/users/$userId": createFileCommand("/users/$userId")({
        description: "User",
        handler: async () => "user",
      }),
    } as Record<string, FileCommand>;

    const layouts = findLayoutChain("/users/$userId", mixedTree);
    expect(layouts).toEqual([]);
  });

  it("returns empty array for root path", () => {
    const tree = createMockTree();
    const layouts = findLayoutChain("/", tree);
    expect(layouts).toEqual([]);
  });
});

describe("executeWithLayouts", () => {
  it("executes command directly when no layouts", async () => {
    const command = createFileCommand("/test")({
      description: "Test",
      handler: async () => "content",
    });

    const result = await executeWithLayouts(command, [], createRoute(), {});
    expect(result).toBe("content");
  });

  it("wraps command with single layout", async () => {
    const layout = createFileCommand("/_auth")({
      description: "Auth layout",
      handler: async ({ outlet }) => {
        const content = await outlet;
        return `[auth]${content}[/auth]`;
      },
    });

    const command = createFileCommand("/_auth/protected")({
      description: "Protected",
      handler: async () => "secret",
    });

    const result = await executeWithLayouts(
      command,
      [layout],
      createRoute({ path: "/_auth/protected" }),
      {},
    );

    expect(result).toBe("[auth]secret[/auth]");
  });

  it("wraps command with nested layouts (outermost to innermost)", async () => {
    const outerLayout = createFileCommand("/_auth")({
      description: "Auth layout",
      handler: async ({ outlet }) => {
        const content = await outlet;
        return `[outer]${content}[/outer]`;
      },
    });

    const innerLayout = createFileCommand("/_auth/_admin")({
      description: "Admin layout",
      handler: async ({ outlet }) => {
        const content = await outlet;
        return `[inner]${content}[/inner]`;
      },
    });

    const command = createFileCommand("/_auth/_admin/dashboard")({
      description: "Dashboard",
      handler: async () => "dashboard",
    });

    const result = await executeWithLayouts(
      command,
      [outerLayout, innerLayout],
      createRoute({ path: "/_auth/_admin/dashboard" }),
      {},
    );

    expect(result).toBe("[outer][inner]dashboard[/inner][/outer]");
  });

  it("layout can access outlet result asynchronously", async () => {
    const layout = createFileCommand("/_auth")({
      description: "Auth layout",
      handler: async ({ outlet }) => {
        // Simulate some async work before accessing outlet
        await new Promise((resolve) => setTimeout(resolve, 10));
        const content = await outlet;
        return `wrapped: ${content}`;
      },
    });

    const command = createFileCommand("/_auth/slow")({
      description: "Slow",
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "slow content";
      },
    });

    const result = await executeWithLayouts(
      command,
      [layout],
      createRoute({ path: "/_auth/slow" }),
      {},
    );

    expect(result).toBe("wrapped: slow content");
  });

  it("layout receives same context as command", async () => {
    let layoutContext: any = null;
    let commandContext: any = null;

    const layout = createFileCommand("/_auth")({
      description: "Layout",
      handler: async ({ context, outlet }) => {
        layoutContext = context;
        return await outlet;
      },
    });

    const command = createFileCommand("/_auth/test")({
      description: "Test",
      handler: async ({ context }) => {
        commandContext = context;
        return "done";
      },
    });

    const userContext = { user: { id: "123" } };
    await executeWithLayouts(command, [layout], createRoute({ path: "/_auth/test" }), userContext);

    expect(layoutContext).toEqual(userContext);
    expect(commandContext).toEqual(userContext);
  });
});
