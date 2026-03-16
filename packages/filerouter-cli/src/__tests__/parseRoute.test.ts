import { describe, it, expect } from "bun:test";
import { createParseRoute, type RouteTable } from "../parseRoute";
import { ParseError } from "../errors";
import type { FileCommand } from "../types";

// Helper to create a minimal mock command
function mockCommand(path: string, options?: { validateArgs?: unknown; aliases?: Record<string, string[]> }): FileCommand<any, any, any, any> {
  return {
    __path: path,
    config: {
      description: `Test command for ${path}`,
      handler: async () => {},
      validateArgs: options?.validateArgs,
      aliases: options?.aliases,
    },
  };
}

describe("createParseRoute", () => {
  describe("basic routing", () => {
    it("matches root command with no arguments", () => {
      const commandsTree = {
        "/": mockCommand("/"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: [],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli"]);

      expect(result.path).toBe("/");
      expect(result.params).toEqual({});
    });

    it("matches static route", () => {
      const commandsTree = {
        "/": mockCommand("/"),
        "/auth": mockCommand("/auth"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {
          auth: "/auth",
        },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["auth"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "auth"]);

      expect(result.path).toBe("/auth");
      expect(result.params).toEqual({});
    });

    it("matches static route case-insensitively", () => {
      const commandsTree = {
        "/auth": mockCommand("/auth"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {
          auth: "/auth",
        },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["auth"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);

      expect(parseRoute(["node", "cli", "AUTH"]).path).toBe("/auth");
      expect(parseRoute(["node", "cli", "Auth"]).path).toBe("/auth");
    });
  });

  describe("dynamic routes", () => {
    it("matches dynamic route and captures params", () => {
      const commandsTree = {
        "/list/$projectId": mockCommand("/list/$projectId"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [
          {
            segments: ["list", "$projectId"],
            path: "/list/$projectId",
            paramIndices: { projectId: 1 },
          },
        ],
        splatRoutes: [],
        availableCommands: ["list <projectId>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "list", "my-project"]);

      expect(result.path).toBe("/list/$projectId");
      expect(result.params).toEqual({ projectId: "my-project" });
    });

    it("matches nested dynamic route", () => {
      const commandsTree = {
        "/users/$userId/posts/$postId": mockCommand("/users/$userId/posts/$postId"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [
          {
            segments: ["users", "$userId", "posts", "$postId"],
            path: "/users/$userId/posts/$postId",
            paramIndices: { userId: 1, postId: 3 },
          },
        ],
        splatRoutes: [],
        availableCommands: ["users <userId> posts <postId>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "users", "123", "posts", "456"]);

      expect(result.path).toBe("/users/$userId/posts/$postId");
      expect(result.params).toEqual({ userId: "123", postId: "456" });
    });
  });

  describe("splat routes", () => {
    it("matches splat route and captures remaining args", () => {
      const commandsTree = {
        "/add/$": mockCommand("/add/$"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [],
        splatRoutes: [
          { parentSegments: ["add"], path: "/add/$" },
        ],
        availableCommands: ["add <items...>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "add", "package1", "package2", "package3"]);

      expect(result.path).toBe("/add/$");
      expect(result.params).toEqual({ _splat: ["package1", "package2", "package3"] });
    });

    it("matches splat route with empty splat args", () => {
      const commandsTree = {
        "/add/$": mockCommand("/add/$"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [],
        splatRoutes: [
          { parentSegments: ["add"], path: "/add/$" },
        ],
        availableCommands: ["add <items...>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "add"]);

      expect(result.path).toBe("/add/$");
      expect(result.params).toEqual({ _splat: [] });
    });

    it("prefers more specific splat route", () => {
      const commandsTree = {
        "/add/$": mockCommand("/add/$"),
        "/add/dev/$": mockCommand("/add/dev/$"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [],
        splatRoutes: [
          { parentSegments: ["add"], path: "/add/$" },
          { parentSegments: ["add", "dev"], path: "/add/dev/$" },
        ],
        availableCommands: ["add <items...>", "add dev <items...>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "add", "dev", "package1"]);

      expect(result.path).toBe("/add/dev/$");
      expect(result.params).toEqual({ _splat: ["package1"] });
    });
  });

  describe("route priority", () => {
    it("prefers static routes over dynamic routes", () => {
      const commandsTree = {
        "/list": mockCommand("/list"),
        "/list/$projectId": mockCommand("/list/$projectId"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {
          list: "/list",
        },
        dynamicRoutes: [
          {
            segments: ["list", "$projectId"],
            path: "/list/$projectId",
            paramIndices: { projectId: 1 },
          },
        ],
        splatRoutes: [],
        availableCommands: ["list", "list <projectId>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);

      // With just "list", should match static route
      expect(parseRoute(["node", "cli", "list"]).path).toBe("/list");

      // With "list something", should match dynamic route
      expect(parseRoute(["node", "cli", "list", "my-project"]).path).toBe("/list/$projectId");
    });

    it("prefers static/dynamic routes over splat routes with greedy matching", () => {
      const commandsTree = {
        "/add": mockCommand("/add"),
        "/add/$": mockCommand("/add/$"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {
          add: "/add",
        },
        dynamicRoutes: [],
        splatRoutes: [
          { parentSegments: ["add"], path: "/add/$" },
        ],
        availableCommands: ["add", "add <items...>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);

      // With just "add", should match static route
      expect(parseRoute(["node", "cli", "add"]).path).toBe("/add");

      // Greedy matching: "add package1" still matches "/add" because 
      // we try longest match first, then shorter prefixes.
      // The static "/add" route matches the "add" prefix.
      // "package1" is treated as an extra positional arg (not consumed by the route)
      expect(parseRoute(["node", "cli", "add", "package1"]).path).toBe("/add");
    });

    it("uses splat route when no static route exists for prefix", () => {
      const commandsTree = {
        "/add/$": mockCommand("/add/$"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [],
        splatRoutes: [
          { parentSegments: ["add"], path: "/add/$" },
        ],
        availableCommands: ["add <items...>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);

      // Without a static "/add" route, splat route handles all "add ..." commands
      expect(parseRoute(["node", "cli", "add"]).path).toBe("/add/$");
      expect(parseRoute(["node", "cli", "add", "package1"]).path).toBe("/add/$");
    });
  });

  describe("flags parsing", () => {
    it("parses flags into args", () => {
      const commandsTree = {
        "/auth": mockCommand("/auth"),
      };
      const routeTable: RouteTable = {
        staticRoutes: { auth: "/auth" },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["auth"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "auth", "--username", "john", "--verbose"]);

      expect(result.path).toBe("/auth");
      expect(result.args).toEqual({ username: "john", verbose: true });
    });

    it("preserves rawArgs", () => {
      const commandsTree = {
        "/auth": mockCommand("/auth"),
      };
      const routeTable: RouteTable = {
        staticRoutes: { auth: "/auth" },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["auth"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "auth", "--username", "john"]);

      expect(result.rawArgs).toEqual(["auth", "--username", "john"]);
    });

    it("ignores flags when identifying command", () => {
      const commandsTree = {
        "/add/$": mockCommand("/add/$"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [],
        splatRoutes: [
          { parentSegments: ["add"], path: "/add/$" },
        ],
        availableCommands: ["add <items...>"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      // Flags like -D should be parsed as flags, not positional args
      const result = parseRoute(["node", "cli", "add", "-D", "typescript"]);

      expect(result.path).toBe("/add/$");
      expect(result.params).toEqual({ _splat: ["typescript"] });
      expect(result.args).toHaveProperty("D");
    });
  });

  describe("error handling", () => {
    it("throws ParseError for unknown command", () => {
      const commandsTree = {
        "/auth": mockCommand("/auth"),
      };
      const routeTable: RouteTable = {
        staticRoutes: { auth: "/auth" },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["auth"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);

      expect(() => parseRoute(["node", "cli", "unknown"])).toThrow(ParseError);
    });

    it("includes available commands in error message", () => {
      const commandsTree = {
        "/auth": mockCommand("/auth"),
        "/list": mockCommand("/list"),
      };
      const routeTable: RouteTable = {
        staticRoutes: { auth: "/auth", list: "/list" },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["auth", "list"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);

      try {
        parseRoute(["node", "cli", "unknown"]);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).help).toContain("auth");
        expect((error as ParseError).help).toContain("list");
      }
    });

    it("has UNKNOWN_COMMAND error code", () => {
      const commandsTree = {};
      const routeTable: RouteTable = {
        staticRoutes: {},
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: [],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);

      try {
        parseRoute(["node", "cli", "unknown"]);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).code).toBe("UNKNOWN_COMMAND");
      }
    });
  });

  describe("pathless layouts", () => {
    it("matches commands under pathless layouts", () => {
      const commandsTree = {
        "/_auth/protected": mockCommand("/_auth/protected"),
      };
      const routeTable: RouteTable = {
        staticRoutes: {
          protected: "/_auth/protected",
        },
        dynamicRoutes: [],
        splatRoutes: [],
        availableCommands: ["protected"],
      };

      const parseRoute = createParseRoute(commandsTree, routeTable);
      const result = parseRoute(["node", "cli", "protected"]);

      expect(result.path).toBe("/_auth/protected");
    });
  });
});
