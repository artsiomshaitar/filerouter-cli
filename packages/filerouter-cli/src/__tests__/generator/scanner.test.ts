import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  scanCommands,
  routePathToVarName,
  routePathToCliCommand,
} from "../../generator/scanner";

describe("scanCommands", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "filerouter-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // Helper to create a command file
  async function createFile(relativePath: string, content = "export const Command = {};") {
    const fullPath = join(tempDir, relativePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content);
  }

  describe("static routes", () => {
    it("scans auth.ts -> /auth", async () => {
      await createFile("auth.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/auth");
      expect(result.commands[0].filePath).toBe("auth.ts");
    });

    it("scans list/index.ts -> /list", async () => {
      await createFile("list/index.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/list");
    });

    it("scans nested directories", async () => {
      await createFile("users/settings/profile.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/users/settings/profile");
    });

    it("scans multiple static routes", async () => {
      await createFile("auth.ts");
      await createFile("list.ts");
      await createFile("deploy.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(3);
      const paths = result.commands.map((c) => c.routePath);
      expect(paths).toContain("/auth");
      expect(paths).toContain("/list");
      expect(paths).toContain("/deploy");
    });
  });

  describe("dynamic routes ($param)", () => {
    it("scans $projectId.ts -> /$projectId", async () => {
      await createFile("$projectId.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/$projectId");
      expect(result.commands[0].hasParams).toBe(true);
      expect(result.commands[0].paramNames).toEqual(["projectId"]);
    });

    it("scans list/$projectId.ts -> /list/$projectId", async () => {
      await createFile("list/$projectId.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/list/$projectId");
      expect(result.commands[0].paramNames).toEqual(["projectId"]);
    });

    it("scans multiple params in path", async () => {
      await createFile("users/$userId/posts/$postId.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/users/$userId/posts/$postId");
      expect(result.commands[0].paramNames).toEqual(["userId", "postId"]);
    });
  });

  describe("splat routes ($)", () => {
    it("scans $.ts -> /$", async () => {
      await createFile("$.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/$");
      expect(result.commands[0].isSplat).toBe(true);
      expect(result.commands[0].paramNames).toEqual(["_splat"]);
    });

    it("scans add/$.ts -> /add/$", async () => {
      await createFile("add/$.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/add/$");
      expect(result.commands[0].isSplat).toBe(true);
    });

    it("splat has hasParams = true", async () => {
      await createFile("add/$.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands[0].hasParams).toBe(true);
    });
  });

  describe("pathless layouts (_prefix)", () => {
    it("scans _auth/route.ts -> /_auth (layout)", async () => {
      await createFile("_auth/route.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/_auth");
      expect(result.commands[0].isLayout).toBe(true);
      expect(result.commands[0].isPathless).toBe(true);
    });

    it("scans _auth/protected.ts -> /_auth/protected", async () => {
      await createFile("_auth/protected.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/_auth/protected");
      expect(result.commands[0].isPathless).toBe(true);
      expect(result.commands[0].isLayout).toBe(false);
    });

    it("layout and child routes", async () => {
      await createFile("_auth/route.ts");
      await createFile("_auth/protected.ts");
      await createFile("_auth/settings.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(3);

      const layout = result.commands.find((c) => c.routePath === "/_auth");
      expect(layout?.isLayout).toBe(true);

      const child = result.commands.find((c) => c.routePath === "/_auth/protected");
      expect(child?.isLayout).toBe(false);
    });

    it("nested pathless layouts", async () => {
      await createFile("_auth/route.ts");
      await createFile("_auth/_admin/route.ts");
      await createFile("_auth/_admin/dashboard.ts");

      const result = await scanCommands(tempDir);

      const adminLayout = result.commands.find((c) => c.routePath === "/_auth/_admin");
      expect(adminLayout?.isLayout).toBe(true);
      expect(adminLayout?.isPathless).toBe(true);
    });
  });

  describe("index files", () => {
    it("index.ts at root -> /", async () => {
      await createFile("index.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/");
    });

    it("list/index.ts -> /list", async () => {
      await createFile("list/index.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].routePath).toBe("/list");
    });

    it("index.ts in _ directory is layout", async () => {
      await createFile("_layout/index.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands[0].isLayout).toBe(true);
    });
  });

  describe("ignore patterns", () => {
    it("ignores .test.ts files", async () => {
      await createFile("auth.ts");
      await createFile("auth.test.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].filePath).toBe("auth.ts");
    });

    it("ignores .spec.ts files", async () => {
      await createFile("auth.ts");
      await createFile("auth.spec.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
    });

    it("ignores .d.ts files", async () => {
      await createFile("auth.ts");
      await createFile("auth.d.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
    });

    it("does NOT ignore route.ts in _ directories", async () => {
      await createFile("_auth/route.ts");

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].isLayout).toBe(true);
    });
  });

  describe("splat route validation", () => {
    it("throws error if splat route has children", async () => {
      await createFile("add/$.ts");
      await createFile("add/$/child.ts"); // Invalid: child of splat

      await expect(scanCommands(tempDir)).rejects.toThrow(
        /Splat route.*cannot have child routes/
      );
    });

    it("allows sibling routes next to splat", async () => {
      await createFile("add/$.ts");
      await createFile("add.ts"); // Sibling, not child

      const result = await scanCommands(tempDir);

      expect(result.commands).toHaveLength(2);
    });
  });

  describe("file extensions", () => {
    it("supports .ts files", async () => {
      await createFile("auth.ts");
      const result = await scanCommands(tempDir);
      expect(result.commands).toHaveLength(1);
    });

    it("supports .tsx files", async () => {
      await createFile("auth.tsx");
      const result = await scanCommands(tempDir);
      expect(result.commands).toHaveLength(1);
    });

    it("supports .js files", async () => {
      await createFile("auth.js");
      const result = await scanCommands(tempDir);
      expect(result.commands).toHaveLength(1);
    });

    it("supports .jsx files", async () => {
      await createFile("auth.jsx");
      const result = await scanCommands(tempDir);
      expect(result.commands).toHaveLength(1);
    });
  });

  describe("result properties", () => {
    it("returns correct rootDir", async () => {
      await createFile("auth.ts");

      const result = await scanCommands(tempDir);

      expect(result.rootDir).toBe(tempDir);
    });

    it("commands are sorted by path", async () => {
      await createFile("zoo.ts");
      await createFile("alpha.ts");
      await createFile("mid.ts");
      await createFile("index.ts");

      const result = await scanCommands(tempDir);

      const paths = result.commands.map((c) => c.routePath);
      // Root "/" should be first, then alphabetical
      expect(paths[0]).toBe("/");
    });
  });
});

describe("routePathToVarName", () => {
  it("/ -> Index (to avoid conflict with RootCommand from __root.ts)", () => {
    expect(routePathToVarName("/")).toBe("Index");
  });

  it("/auth -> Auth", () => {
    expect(routePathToVarName("/auth")).toBe("Auth");
  });

  it("/list/$projectId -> ListProjectId", () => {
    expect(routePathToVarName("/list/$projectId")).toBe("ListProjectId");
  });

  it("/_auth -> LayoutAuth", () => {
    expect(routePathToVarName("/_auth")).toBe("LayoutAuth");
  });

  it("/_auth/protected -> LayoutAuthProtected", () => {
    expect(routePathToVarName("/_auth/protected")).toBe("LayoutAuthProtected");
  });

  it("/add/$ -> AddSplat", () => {
    expect(routePathToVarName("/add/$")).toBe("AddSplat");
  });

  it("/users/$userId/posts/$postId -> UsersUserIdPostsPostId", () => {
    expect(routePathToVarName("/users/$userId/posts/$postId")).toBe(
      "UsersUserIdPostsPostId"
    );
  });

  it("capitalizes first letter of each segment", () => {
    expect(routePathToVarName("/myCommand")).toBe("MyCommand");
    expect(routePathToVarName("/my-command")).toBe("My-command"); // preserves dash
  });
});

describe("routePathToCliCommand", () => {
  it("/ -> empty string", () => {
    expect(routePathToCliCommand("/")).toBe("");
  });

  it("/auth -> auth", () => {
    expect(routePathToCliCommand("/auth")).toBe("auth");
  });

  it("/list/$projectId -> list <projectId>", () => {
    expect(routePathToCliCommand("/list/$projectId")).toBe("list <projectId>");
  });

  it("/_auth/protected -> protected", () => {
    expect(routePathToCliCommand("/_auth/protected")).toBe("protected");
  });

  it("/add/$ -> add <items...>", () => {
    expect(routePathToCliCommand("/add/$")).toBe("add <items...>");
  });

  it("/users/$userId/posts/$postId -> users <userId> posts <postId>", () => {
    expect(routePathToCliCommand("/users/$userId/posts/$postId")).toBe(
      "users <userId> posts <postId>"
    );
  });

  it("strips pathless segments", () => {
    expect(routePathToCliCommand("/_layout/command")).toBe("command");
    expect(routePathToCliCommand("/_auth/_admin/dashboard")).toBe("dashboard");
  });
});
