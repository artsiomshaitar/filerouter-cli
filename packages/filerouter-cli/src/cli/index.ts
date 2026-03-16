#!/usr/bin/env bun

import { parseArgs } from "util";
import { getVersion } from "./version.js";

const VERSION = getVersion();

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    commands: {
      type: "string",
      short: "c",
      default: "./commands",
    },
    output: {
      type: "string",
      short: "o",
      default: "./commandsTree.gen.ts",
    },
    help: {
      type: "boolean",
      short: "h",
      default: false,
    },
    version: {
      type: "boolean",
      short: "v",
      default: false,
    },
  },
  allowPositionals: true,
});

function showHelp() {
  console.log(`
FileRouter CLI v${VERSION}

Usage: filerouter-cli <command> [options]

Commands:
  init <name>        Create a new filerouter-cli project
  dev <entry>        Start dev mode with file watching
  generate           Generate commandsTree.gen.ts
  completion         Generate shell completion scripts

Options:
  -c, --commands <dir>   Commands directory (default: ./commands)
  -o, --output <file>    Generated file (default: ./commandsTree.gen.ts)
  -h, --help             Show this help message
  -v, --version          Show version

Examples:
  filerouter-cli init my-cli
  filerouter-cli dev main.ts
  filerouter-cli generate
  filerouter-cli completion bash >> ~/.bashrc
`);
}

function showVersion() {
  console.log(`filerouter-cli v${VERSION}`);
}

async function main() {
  if (values.version) {
    showVersion();
    process.exit(0);
  }

  if (values.help || positionals.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = positionals[0];
  const options = {
    commandsDirectory: values.commands as string,
    generatedFile: values.output as string,
  };

  switch (command) {
    case "init": {
      const projectName = positionals[1];
      if (!projectName) {
        console.error("Error: Project name is required.\n");
        console.log("Usage: filerouter-cli init <project-name>");
        process.exit(1);
      }
      const { runInit } = await import("./init.js");
      await runInit({ projectName });
      break;
    }
    case "dev": {
      const entryPoint = positionals[1];
      if (!entryPoint) {
        console.error("Error: Entry point is required.\n");
        console.log("Usage: filerouter-cli dev <entry>");
        console.log("\nExample:");
        console.log("  filerouter-cli dev main.ts");
        process.exit(1);
      }
      const { runDev } = await import("./dev.js");
      await runDev({ ...options, entryPoint });
      break;
    }
    case "generate": {
      const { runGenerate } = await import("./generate.js");
      await runGenerate(options);
      break;
    }
    case "completion": {
      const shell = positionals[1];
      const { generateCompletion } = await import("./completion.js");
      generateCompletion(shell);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
