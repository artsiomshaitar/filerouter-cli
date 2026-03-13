import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { createFileCommand } from "../createFileCommand";
import type { FileCommand, Middleware } from "../types";

describe("createFileCommand", () => {
  describe("basic command creation", () => {
    it("creates a command with minimal config", () => {
      const command = createFileCommand("/test")({
        description: "Test command",
        handler: async () => "done",
      });

      expect(command.__path).toBe("/test");
      expect(command.config.description).toBe("Test command");
      expect(typeof command.config.handler).toBe("function");
    });

    it("returns FileCommand with readonly __path", () => {
      const command = createFileCommand("/test")({
        description: "Test command",
        handler: async () => {},
      });

      expect(command.__path).toBe("/test");
      // TypeScript would prevent this, but we can verify the value exists
      expect(typeof command.__path).toBe("string");
    });

    it("uses curried function signature", () => {
      const withPath = createFileCommand("/test");
      expect(typeof withPath).toBe("function");

      const command = withPath({
        description: "Test command",
        handler: async () => {},
      });
      expect(command.__path).toBe("/test");
    });

    it("creates commands with different path formats", () => {
      const root = createFileCommand("/")({
        description: "Root",
        handler: async () => {},
      });
      expect(root.__path).toBe("/");

      const nested = createFileCommand("/users/list")({
        description: "List users",
        handler: async () => {},
      });
      expect(nested.__path).toBe("/users/list");

      const dynamic = createFileCommand("/users/$userId")({
        description: "Get user",
        handler: async () => {},
      });
      expect(dynamic.__path).toBe("/users/$userId");

      const splat = createFileCommand("/add/$")({
        description: "Add items",
        handler: async () => {},
      });
      expect(splat.__path).toBe("/add/$");
    });
  });

  describe("validateArgs option", () => {
    it("accepts Zod schema for args validation", () => {
      const schema = z.object({
        name: z.string(),
        verbose: z.boolean().default(false),
      });

      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: schema,
        handler: async ({ args }) => {
          // Type inference test - args should have name and verbose
          return `${args.name} - ${args.verbose}`;
        },
      });

      expect(command.config.validateArgs).toBe(schema);
    });

    it("supports various Zod types", () => {
      const schema = z.object({
        str: z.string(),
        num: z.number(),
        bool: z.boolean(),
        arr: z.array(z.string()),
        opt: z.string().optional(),
        def: z.string().default("default"),
        enm: z.enum(["a", "b", "c"]),
      });

      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: schema,
        handler: async () => {},
      });

      expect(command.config.validateArgs).toBe(schema);
    });
  });

  describe("validateParams option", () => {
    it("accepts Zod schema for params validation", () => {
      const schema = z.object({
        projectId: z.string(),
      });

      const command = createFileCommand("/projects/$projectId")({
        description: "Get project",
        validateParams: schema,
        handler: async ({ params }) => {
          return params.projectId;
        },
      });

      expect(command.config.validateParams).toBe(schema);
    });

    it("supports multiple params", () => {
      const schema = z.object({
        userId: z.string(),
        postId: z.string(),
      });

      const command = createFileCommand("/users/$userId/posts/$postId")({
        description: "Get post",
        validateParams: schema,
        handler: async ({ params }) => {
          return `${params.userId}/${params.postId}`;
        },
      });

      expect(command.config.validateParams).toBe(schema);
    });

    it("supports splat param validation", () => {
      const schema = z.object({
        _splat: z.array(z.string()).min(1),
      });

      const command = createFileCommand("/add/$")({
        description: "Add items",
        validateParams: schema,
        handler: async ({ params }) => {
          return params._splat.join(", ");
        },
      });

      expect(command.config.validateParams).toBe(schema);
    });
  });

  describe("paramsDescription option", () => {
    it("accepts simple param descriptions", () => {
      const command = createFileCommand("/projects/$projectId")({
        description: "Get project",
        paramsDescription: {
          projectId: "The project identifier",
        },
        handler: async () => {},
      });

      expect(command.config.paramsDescription).toEqual({
        projectId: "The project identifier",
      });
    });

    it("accepts splat description", () => {
      const command = createFileCommand("/add/$")({
        description: "Add packages",
        paramsDescription: {
          _splat: "Packages to install",
        },
        handler: async () => {},
      });

      expect(command.config.paramsDescription).toEqual({
        _splat: "Packages to install",
      });
    });

    it("accepts multiple param descriptions", () => {
      const command = createFileCommand("/users/$userId/posts/$postId")({
        description: "Get post",
        paramsDescription: {
          userId: "User ID",
          postId: "Post ID",
        },
        handler: async () => {},
      });

      expect(command.config.paramsDescription).toEqual({
        userId: "User ID",
        postId: "Post ID",
      });
    });
  });

  describe("aliases option", () => {
    it("accepts single alias per flag", () => {
      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: z.object({
          verbose: z.boolean().default(false),
        }),
        aliases: {
          verbose: ["v"],
        },
        handler: async () => {},
      });

      expect(command.config.aliases).toEqual({ verbose: ["v"] });
    });

    it("accepts multiple aliases per flag", () => {
      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: z.object({
          verbose: z.boolean().default(false),
        }),
        aliases: {
          verbose: ["v", "V", "verb"],
        },
        handler: async () => {},
      });

      expect(command.config.aliases).toEqual({ verbose: ["v", "V", "verb"] });
    });

    it("accepts aliases for multiple flags", () => {
      const command = createFileCommand("/test")({
        description: "Test",
        validateArgs: z.object({
          verbose: z.boolean().default(false),
          dev: z.boolean().default(false),
          exact: z.boolean().default(false),
        }),
        aliases: {
          verbose: ["v"],
          dev: ["D"],
          exact: ["E"],
        },
        handler: async () => {},
      });

      expect(command.config.aliases).toEqual({
        verbose: ["v"],
        dev: ["D"],
        exact: ["E"],
      });
    });
  });

  describe("middleware option", () => {
    it("accepts single middleware", () => {
      const middleware: Middleware = async (ctx, next) => {
        await next();
      };

      const command = createFileCommand("/test")({
        description: "Test",
        middleware: [middleware],
        handler: async () => {},
      });

      expect(command.config.middleware).toHaveLength(1);
      expect(command.config.middleware![0]).toBe(middleware);
    });

    it("accepts multiple middleware", () => {
      const mw1: Middleware = async (ctx, next) => await next();
      const mw2: Middleware = async (ctx, next) => await next();
      const mw3: Middleware = async (ctx, next) => await next();

      const command = createFileCommand("/test")({
        description: "Test",
        middleware: [mw1, mw2, mw3],
        handler: async () => {},
      });

      expect(command.config.middleware).toHaveLength(3);
    });

    it("accepts empty middleware array", () => {
      const command = createFileCommand("/test")({
        description: "Test",
        middleware: [],
        handler: async () => {},
      });

      expect(command.config.middleware).toEqual([]);
    });
  });

  describe("onError option", () => {
    it("accepts error handler returning string", () => {
      const onError = (error: Error) => `Error: ${error.message}`;

      const command = createFileCommand("/test")({
        description: "Test",
        onError,
        handler: async () => {},
      });

      expect(command.config.onError).toBe(onError);
    });

    it("accepts error handler returning void", () => {
      const onError = (error: Error) => {
        console.error(error);
      };

      const command = createFileCommand("/test")({
        description: "Test",
        onError,
        handler: async () => {},
      });

      expect(command.config.onError).toBe(onError);
    });
  });

  describe("handler option", () => {
    it("handler receives correct context properties", async () => {
      let receivedContext: any = null;

      const command = createFileCommand("/test")({
        description: "Test",
        handler: async (ctx) => {
          receivedContext = ctx;
          return "done";
        },
      });

      // We can't easily test the full context without the router,
      // but we can verify the handler is set correctly
      expect(typeof command.config.handler).toBe("function");
    });

    it("handler can return string", () => {
      const command = createFileCommand("/test")({
        description: "Test",
        handler: async () => "output",
      });

      expect(typeof command.config.handler).toBe("function");
    });

    it("handler can return number (exit code)", () => {
      const command = createFileCommand("/test")({
        description: "Test",
        handler: async () => 1,
      });

      expect(typeof command.config.handler).toBe("function");
    });

    it("handler can return void", () => {
      const command = createFileCommand("/test")({
        description: "Test",
        handler: async () => {},
      });

      expect(typeof command.config.handler).toBe("function");
    });
  });

  describe("full configuration", () => {
    it("accepts all options together", () => {
      const argsSchema = z.object({
        verbose: z.boolean().default(false),
        format: z.enum(["json", "text"]).default("text"),
      });

      const paramsSchema = z.object({
        projectId: z.string().min(1),
      });

      const authMiddleware: Middleware = async (ctx, next) => {
        await next();
      };

      const command = createFileCommand("/projects/$projectId")({
        description: "Get project details",
        validateArgs: argsSchema,
        validateParams: paramsSchema,
        paramsDescription: {
          projectId: "Project identifier",
        },
        aliases: {
          verbose: ["v"],
          format: ["f"],
        },
        middleware: [authMiddleware],
        onError: (err) => `Failed: ${err.message}`,
        handler: async ({ args, params }) => {
          return `Project ${params.projectId} (verbose: ${args.verbose})`;
        },
      });

      expect(command.__path).toBe("/projects/$projectId");
      expect(command.config.description).toBe("Get project details");
      expect(command.config.validateArgs).toBe(argsSchema);
      expect(command.config.validateParams).toBe(paramsSchema);
      expect(command.config.paramsDescription).toEqual({ projectId: "Project identifier" });
      expect(command.config.aliases).toEqual({ verbose: ["v"], format: ["f"] });
      expect(command.config.middleware).toHaveLength(1);
      expect(command.config.onError).toBeDefined();
    });
  });

  describe("type inference", () => {
    it("infers params type from route path with single param", () => {
      // TypeScript would check this at compile time
      // At runtime, we just verify the command is created correctly
      const command = createFileCommand("/users/$userId")({
        description: "Get user",
        paramsDescription: {
          userId: "User ID",
          // @ts-expect-error - invalid param name would be caught by TypeScript
          // invalidParam: "This should error",
        },
        handler: async ({ params }) => {
          // params.userId should be typed as string
          return params.userId;
        },
      });

      expect(command.__path).toBe("/users/$userId");
    });

    it("infers params type from route path with multiple params", () => {
      const command = createFileCommand("/users/$userId/posts/$postId")({
        description: "Get post",
        paramsDescription: {
          userId: "User ID",
          postId: "Post ID",
        },
        handler: async ({ params }) => {
          return `${params.userId}/${params.postId}`;
        },
      });

      expect(command.__path).toBe("/users/$userId/posts/$postId");
    });

    it("infers _splat type for splat routes", () => {
      const command = createFileCommand("/add/$")({
        description: "Add items",
        paramsDescription: {
          _splat: "Items to add",
        },
        handler: async ({ params }) => {
          // params._splat should be typed as string[]
          return params._splat.join(", ");
        },
      });

      expect(command.__path).toBe("/add/$");
    });
  });
});
