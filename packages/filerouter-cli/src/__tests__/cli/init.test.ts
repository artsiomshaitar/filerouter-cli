import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runInit } from "../../cli/init";

describe("runInit", () => {
  let tmpDir: string;
  let originalCwd: string;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let logOutput: string[];
  let errorOutput: string[];
  let exitCode: number | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "filerouter-init-test-"));
    originalCwd = process.cwd();
    process.chdir(tmpDir);

    logOutput = [];
    errorOutput = [];
    exitCode = undefined;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalProcessExit = process.exit;
    console.log = (...args: unknown[]) => logOutput.push(args.join(" "));
    console.error = (...args: unknown[]) => errorOutput.push(args.join(" "));
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as typeof process.exit;
  });

  afterEach(() => {
    process.chdir(originalCwd);
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a project directory with all expected files", async () => {
    await runInit({ projectName: "my-cli" });

    const projectDir = path.join(tmpDir, "my-cli");
    expect(fs.existsSync(projectDir)).toBe(true);

    const expectedFiles = [
      "package.json",
      "tsconfig.json",
      "main.ts",
      "commands/__root.ts",
      "commands/index.ts",
      "commands/hello.ts",
      ".gitignore",
    ];

    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(projectDir, file))).toBe(true);
    }
  });

  it("generates valid package.json with the project name", async () => {
    await runInit({ projectName: "test-app" });

    const pkgPath = path.join(tmpDir, "test-app", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    expect(pkg.name).toBe("test-app");
    expect(pkg.version).toBe("0.1.0");
    expect(pkg.type).toBe("module");
    expect(pkg.bin["test-app"]).toBe("./main.ts");
    expect(pkg.dependencies["filerouter-cli"]).toBeDefined();
    expect(pkg.dependencies.zod).toBeDefined();
  });

  it("generates main.ts with router setup", async () => {
    await runInit({ projectName: "my-cli" });

    const mainTs = fs.readFileSync(path.join(tmpDir, "my-cli", "main.ts"), "utf-8");
    expect(mainTs).toContain("#!/usr/bin/env bun");
    expect(mainTs).toContain("createCommandsRouter");
    expect(mainTs).toContain("router.run(process.argv)");
    expect(mainTs).toContain(".catch(() => process.exit(1))");
  });

  it("generates __root.ts with createRootCommand", async () => {
    await runInit({ projectName: "my-cli" });

    const rootTs = fs.readFileSync(path.join(tmpDir, "my-cli", "commands", "__root.ts"), "utf-8");
    expect(rootTs).toContain("createRootCommand");
    expect(rootTs).toContain("RootCommand");
    expect(rootTs).toContain("AppContext");
  });

  it("generates index.ts with root command handler", async () => {
    await runInit({ projectName: "my-cli" });

    const indexTs = fs.readFileSync(path.join(tmpDir, "my-cli", "commands", "index.ts"), "utf-8");
    expect(indexTs).toContain('createFileCommand("/")');
    expect(indexTs).toContain("commandInfo");
  });

  it("generates hello.ts example command with zod validation", async () => {
    await runInit({ projectName: "my-cli" });

    const helloTs = fs.readFileSync(path.join(tmpDir, "my-cli", "commands", "hello.ts"), "utf-8");
    expect(helloTs).toContain('createFileCommand("/hello")');
    expect(helloTs).toContain("z.object");
    expect(helloTs).toContain("z.string()");
    expect(helloTs).toContain("z.boolean()");
    expect(helloTs).toContain("aliases");
  });

  it("generates valid tsconfig.json", async () => {
    await runInit({ projectName: "my-cli" });

    const tsconfig = JSON.parse(
      fs.readFileSync(path.join(tmpDir, "my-cli", "tsconfig.json"), "utf-8"),
    );
    expect(tsconfig.compilerOptions.target).toBe("ESNext");
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.types).toContain("bun-types");
  });

  it("generates .gitignore with standard entries", async () => {
    await runInit({ projectName: "my-cli" });

    const gitignore = fs.readFileSync(path.join(tmpDir, "my-cli", ".gitignore"), "utf-8");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("dist/");
  });

  it("prints creation messages for each file", async () => {
    await runInit({ projectName: "my-cli" });

    expect(logOutput.some((l) => l.includes("Creating new filerouter-cli project"))).toBe(true);
    expect(logOutput.some((l) => l.includes("package.json"))).toBe(true);
    expect(logOutput.some((l) => l.includes("main.ts"))).toBe(true);
    expect(logOutput.some((l) => l.includes("Done!"))).toBe(true);
  });

  it("prints getting-started instructions", async () => {
    await runInit({ projectName: "my-cli" });

    const output = logOutput.join("\n");
    expect(output).toContain("cd my-cli");
    expect(output).toContain("bun install");
  });

  it("works with an existing empty directory", async () => {
    fs.mkdirSync(path.join(tmpDir, "empty-dir"));
    await runInit({ projectName: "empty-dir" });

    expect(fs.existsSync(path.join(tmpDir, "empty-dir", "package.json"))).toBe(true);
  });

  it("rejects a non-empty existing directory", async () => {
    const dir = path.join(tmpDir, "non-empty");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "existing.txt"), "content");

    try {
      await runInit({ projectName: "non-empty" });
    } catch {
      // expected: process.exit(1) throws
    }

    expect(exitCode).toBe(1);
    expect(errorOutput.some((l) => l.includes("already exists"))).toBe(true);
  });

  it("rejects when path exists as a file", async () => {
    fs.writeFileSync(path.join(tmpDir, "a-file"), "content");

    try {
      await runInit({ projectName: "a-file" });
    } catch {
      // expected: process.exit(1) throws
    }

    expect(exitCode).toBe(1);
    expect(errorOutput.some((l) => l.includes("not a directory"))).toBe(true);
  });
});
