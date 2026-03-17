import { describe, expect, it } from "bun:test";
import { createRootCommand } from "../createRootCommand";

describe("createRootCommand", () => {
  it("creates a root command with description", () => {
    const Root = createRootCommand()({
      description: "Test CLI",
    });

    expect(Root.__isRoot).toBe(true);
    expect(Root.config.description).toBe("Test CLI");
  });

  it("accepts an optional version", () => {
    const Root = createRootCommand()({
      description: "Test CLI",
      version: "1.0.0",
    });

    expect(Root.config.version).toBe("1.0.0");
  });

  it("accepts optional middleware", () => {
    const middleware = async (_ctx: object, next: () => Promise<void>) => {
      await next();
    };
    const Root = createRootCommand()({
      description: "Test CLI",
      middleware: [middleware],
    });

    expect(Root.config.middleware).toHaveLength(1);
  });

  it("preserves context type via generic parameter", () => {
    interface AppContext {
      db: string;
      logger: { info: (msg: string) => void };
    }

    const Root = createRootCommand<AppContext>()({
      description: "Typed CLI",
    });

    // Type-level check: __context should be typed as AppContext
    expect(Root.__isRoot).toBe(true);
    expect(Root.config.description).toBe("Typed CLI");
  });

  describe("update()", () => {
    it("returns a new root command with merged config", () => {
      const Root = createRootCommand()({
        description: "Original",
      });

      const Updated = Root.update({ description: "Updated" });

      expect(Updated.config.description).toBe("Updated");
      expect(Updated.__isRoot).toBe(true);
      // Original is unchanged
      expect(Root.config.description).toBe("Original");
    });

    it("merges config without overwriting unset fields", () => {
      const Root = createRootCommand()({
        description: "Test",
        version: "1.0.0",
      });

      const Updated = Root.update({ description: "Changed" });

      expect(Updated.config.description).toBe("Changed");
      expect(Updated.config.version).toBe("1.0.0");
    });
  });

  describe("_addFileChildren()", () => {
    it("returns a root command with children attached", () => {
      const Root = createRootCommand()({
        description: "Test",
      });

      const children = { "/auth": "auth-command", "/list": "list-command" };
      const WithChildren = Root._addFileChildren(children);

      expect(WithChildren.__isRoot).toBe(true);
      expect(WithChildren.children).toEqual(children);
    });

    it("preserves root config when adding children", () => {
      const Root = createRootCommand()({
        description: "Test",
        version: "2.0.0",
      });

      const WithChildren = Root._addFileChildren({});

      expect(WithChildren.config.description).toBe("Test");
      expect(WithChildren.config.version).toBe("2.0.0");
    });
  });

  it("uses curried factory pattern (double invocation)", () => {
    // The curried pattern: createRootCommand<Context>()({...config})
    const factory = createRootCommand();
    expect(typeof factory).toBe("function");

    const Root = factory({ description: "From factory" });
    expect(Root.__isRoot).toBe(true);
    expect(Root.config.description).toBe("From factory");
  });
});
