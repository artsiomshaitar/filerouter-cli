import { $ } from "bun";

console.log("Building filerouter-cli...");

// Build library
console.log("Building library...");
const libResult = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  splitting: false,
  sourcemap: "linked",
  minify: false,
  external: ["zod", "@filerouter-cli/generator"],
});

if (!libResult.success) {
  console.error("Library build failed:");
  for (const log of libResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Library bundle created");

// Build CLI
console.log("Building CLI...");
const cliResult = await Bun.build({
  entrypoints: ["./src/cli/index.ts"],
  outdir: "./dist/cli",
  target: "bun",
  format: "esm",
  splitting: true,
  sourcemap: "linked",
  minify: false,
  external: ["zod", "@filerouter-cli/generator", "ink", "react"],
});

if (!cliResult.success) {
  console.error("CLI build failed:");
  for (const log of cliResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("CLI bundle created");

// Generate type declarations (only for the library, not CLI)
console.log("Generating type declarations...");
try {
  await $`bunx tsc --emitDeclarationOnly --declaration --outDir dist --rootDir src src/index.ts src/types.ts src/errors.ts src/parser.ts src/middleware.ts src/router.ts src/context.ts src/shell.ts src/help.ts src/createFileCommand.ts src/createRootCommand.ts src/runCommand.ts src/commandInfo.ts src/parseRoute.ts src/packageJson.ts`.quiet();
} catch {
  // TypeScript errors are non-fatal for development
  console.log("Note: Some type declarations may be incomplete");
}

console.log("Build complete!");
