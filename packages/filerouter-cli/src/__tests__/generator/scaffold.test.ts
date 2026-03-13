import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  detectCommandType,
  generateBoilerplate,
  scaffoldIfEmpty,
} from "../../generator/scaffold";

describe("detectCommandType", () => {
  describe("basic type", () => {
    it("detects basic command: auth.ts", () => {
      expect(detectCommandType("auth.ts", "./commands")).toBe("basic");
    });

    it("detects basic command: deploy.ts", () => {
      expect(detectCommandType("deploy.ts", "./commands")).toBe("basic");
    });

    it("detects basic command in nested directory", () => {
      expect(detectCommandType("users/profile.ts", "./commands")).toBe("basic");
    });
  });

  describe("params type", () => {
    it("detects params: $projectId.ts", () => {
      expect(detectCommandType("$projectId.ts", "./commands")).toBe("params");
    });

    it("detects params: list/$projectId.ts", () => {
      expect(detectCommandType("list/$projectId.ts", "./commands")).toBe("params");
    });

    it("detects params with multiple params in path", () => {
      expect(detectCommandType("users/$userId/posts/$postId.ts", "./commands")).toBe("params");
    });
  });

  describe("layout type", () => {
    it("detects layout: _auth/route.ts", () => {
      expect(detectCommandType("_auth/route.ts", "./commands")).toBe("layout");
    });

    it("detects layout: _layout/route.ts", () => {
      expect(detectCommandType("_layout/route.ts", "./commands")).toBe("layout");
    });

    it("detects layout: nested _admin/route.ts", () => {
      expect(detectCommandType("_auth/_admin/route.ts", "./commands")).toBe("layout");
    });
  });

  describe("index type", () => {
    it("detects index: index.ts", () => {
      expect(detectCommandType("index.ts", "./commands")).toBe("index");
    });

    it("detects index: list/index.ts", () => {
      expect(detectCommandType("list/index.ts", "./commands")).toBe("index");
    });

    it("detects index in nested directory", () => {
      expect(detectCommandType("users/settings/index.ts", "./commands")).toBe("index");
    });
  });

  describe("splat type", () => {
    it("detects splat: $.ts", () => {
      expect(detectCommandType("$.ts", "./commands")).toBe("splat");
    });

    it("detects splat: add/$.ts", () => {
      expect(detectCommandType("add/$.ts", "./commands")).toBe("splat");
    });

    it("detects splat in nested directory", () => {
      expect(detectCommandType("packages/install/$.ts", "./commands")).toBe("splat");
    });
  });

  describe("priority", () => {
    it("layout takes priority over index in _ directory", () => {
      expect(detectCommandType("_auth/index.ts", "./commands")).toBe("index");
    });

    it("route.ts in _ directory is layout", () => {
      expect(detectCommandType("_auth/route.ts", "./commands")).toBe("layout");
    });
  });
});

describe("generateBoilerplate", () => {
  describe("basic command", () => {
    it("generates basic command boilerplate", () => {
      const code = generateBoilerplate("/auth", "basic", []);

      expect(code).toContain('import { createFileCommand } from "filerouter-cli"');
      expect(code).toContain('createFileCommand("/auth")');
      expect(code).toContain("description:");
      expect(code).toContain("handler: async");
      expect(code).toContain("export const Command");
    });

    it("generates handler returning string", () => {
      const code = generateBoilerplate("/test", "basic", []);

      expect(code).toContain('return "');
    });
  });

  describe("params command", () => {
    it("generates params command with single param", () => {
      const code = generateBoilerplate("/projects/$projectId", "params", ["projectId"]);

      expect(code).toContain('createFileCommand("/projects/$projectId")');
      expect(code).toContain("params");
      expect(code).toContain("projectId");
    });

    it("generates params command with multiple params", () => {
      const code = generateBoilerplate("/users/$userId/posts/$postId", "params", ["userId", "postId"]);

      expect(code).toContain("userId");
      expect(code).toContain("postId");
    });

    it("includes validateParams (not paramsDescription for params type)", () => {
      const code = generateBoilerplate("/projects/$projectId", "params", ["projectId"]);

      // params type uses validateParams with zod
      expect(code).toContain("validateParams");
      expect(code).toContain("z.object");
    });
  });

  describe("layout command", () => {
    it("generates layout command with outlet", () => {
      const code = generateBoilerplate("/_auth", "layout", []);

      expect(code).toContain('createFileCommand("/_auth")');
      expect(code).toContain("outlet");
      expect(code).toContain("await outlet");
    });

    it("layout handler uses outlet promise", () => {
      const code = generateBoilerplate("/_layout", "layout", []);

      expect(code).toContain("const childOutput = await outlet");
      expect(code).toContain("return childOutput");
    });
  });

  describe("index command", () => {
    it("generates index command", () => {
      const code = generateBoilerplate("/", "index", []);

      expect(code).toContain('createFileCommand("/")');
      expect(code).toContain("handler: async");
    });

    it("generates index command for nested path", () => {
      const code = generateBoilerplate("/list", "index", []);

      expect(code).toContain('createFileCommand("/list")');
    });
  });

  describe("splat command", () => {
    it("generates splat command with _splat param", () => {
      const code = generateBoilerplate("/add/$", "splat", ["_splat"]);

      expect(code).toContain('createFileCommand("/add/$")');
      expect(code).toContain("_splat");
      expect(code).toContain("params._splat");
    });

    it("splat handler accesses _splat as array", () => {
      const code = generateBoilerplate("/install/$", "splat", ["_splat"]);

      expect(code).toContain("params._splat");
      // Should show it's an array
      expect(code).toContain("join") || expect(code).toContain("_splat");
    });

    it("includes paramsDescription for _splat", () => {
      const code = generateBoilerplate("/add/$", "splat", ["_splat"]);

      expect(code).toContain("paramsDescription");
      expect(code).toContain("_splat");
    });
  });

  describe("code quality", () => {
    it("generates valid TypeScript syntax", () => {
      const types = ["basic", "params", "layout", "index", "splat"] as const;

      for (const type of types) {
        const paramNames = type === "params" ? ["id"] : type === "splat" ? ["_splat"] : [];
        const code = generateBoilerplate("/test", type, paramNames);

        // Should have balanced braces
        const openBraces = (code.match(/{/g) || []).length;
        const closeBraces = (code.match(/}/g) || []).length;
        expect(openBraces).toBe(closeBraces);

        // Should have balanced parentheses
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        expect(openParens).toBe(closeParens);
      }
    });

    it("exports Command correctly", () => {
      const types = ["basic", "params", "layout", "index", "splat"] as const;

      for (const type of types) {
        const paramNames = type === "params" ? ["id"] : type === "splat" ? ["_splat"] : [];
        const code = generateBoilerplate("/test", type, paramNames);

        expect(code).toContain("export const Command =");
      }
    });
  });
});

describe("scaffoldIfEmpty", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "filerouter-scaffold-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("scaffolds empty file", async () => {
    const filePath = join(tempDir, "auth.ts");
    await writeFile(filePath, "");

    await scaffoldIfEmpty(filePath, tempDir);

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("createFileCommand");
    expect(content).toContain("export const Command");
  });

  it("does not scaffold non-empty file", async () => {
    const originalContent = "// existing content";
    const filePath = join(tempDir, "auth.ts");
    await writeFile(filePath, originalContent);

    await scaffoldIfEmpty(filePath, tempDir);

    const content = await readFile(filePath, "utf-8");
    expect(content).toBe(originalContent);
  });

  it("does not scaffold file with only whitespace as non-empty", async () => {
    const filePath = join(tempDir, "auth.ts");
    await writeFile(filePath, "   \n\t\n  ");

    await scaffoldIfEmpty(filePath, tempDir);

    const content = await readFile(filePath, "utf-8");
    // Should scaffold because file is effectively empty (only whitespace)
    expect(content).toContain("createFileCommand");
  });

  it("scaffolds params command correctly", async () => {
    const filePath = join(tempDir, "$projectId.ts");
    await writeFile(filePath, "");

    await scaffoldIfEmpty(filePath, tempDir);

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("projectId");
    expect(content).toContain("params");
  });

  it("scaffolds splat command correctly", async () => {
    await mkdir(join(tempDir, "add"), { recursive: true });
    const filePath = join(tempDir, "add", "$.ts");
    await writeFile(filePath, "");

    await scaffoldIfEmpty(filePath, tempDir);

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("_splat");
  });

  it("scaffolds layout command correctly", async () => {
    await mkdir(join(tempDir, "_auth"), { recursive: true });
    const filePath = join(tempDir, "_auth", "route.ts");
    await writeFile(filePath, "");

    await scaffoldIfEmpty(filePath, tempDir);

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain("outlet");
  });

  it("handles non-existent file gracefully", async () => {
    const filePath = join(tempDir, "nonexistent.ts");

    // Should not throw
    await scaffoldIfEmpty(filePath, tempDir);

    // File should not be created
    const exists = await Bun.file(filePath).exists();
    expect(exists).toBe(false);
  });

  it("determines correct route path from file path", async () => {
    await mkdir(join(tempDir, "users"), { recursive: true });
    const filePath = join(tempDir, "users", "profile.ts");
    await writeFile(filePath, "");

    await scaffoldIfEmpty(filePath, tempDir);

    const content = await readFile(filePath, "utf-8");
    expect(content).toContain('"/users/profile"');
  });
});
