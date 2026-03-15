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
    name: {
      type: "string",
      short: "n",
      default: "cli",
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
  init       Create a new filerouter-cli project
  dev        Start interactive dev mode with hot reload
  generate   Generate commandsTree.gen.ts
  completion Generate shell completion scripts

Options:
  -c, --commands <dir>   Commands directory (default: ./commands)
  -o, --output <file>    Generated file (default: ./commandsTree.gen.ts)
  -n, --name <name>      CLI name for help generation (default: cli)
  -h, --help             Show this help message
  -v, --version          Show version

Examples:
  filerouter-cli init my-cli
  filerouter-cli dev
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
    cliName: values.name as string,
  };

  switch (command) {
    case "init": {
      const projectName = positionals[1];
      if (!projectName) {
        console.error("Error: Project name is required.\n");
        console.log("Usage: filerouter-cli init <project-name> [options]");
        console.log("\nOptions:");
        console.log("  -n, --name <name>   CLI name (default: project name)");
        process.exit(1);
      }
      const { runInit } = await import("./init.js");
      await runInit({
        projectName,
        cliName: values.name !== "cli" ? values.name as string : projectName,
      });
      break;
    }
    case "dev": {
      // Check if we're already running with --hot (internal command)
      if (positionals[1] === "__hot__") {
        // Actually run the dev mode (we're now running under bun --hot)
        const { runDev } = await import("./dev.js");
        await runDev(options);
      } else {
        // Spawn ourselves with bun --hot
        const scriptPath = import.meta.path;
        const args = [
          "bun",
          "--hot",
          scriptPath,
          "dev",
          "__hot__",
          "-c", options.commandsDirectory,
          "-o", options.generatedFile,
          "-n", options.cliName,
        ];

        const proc = Bun.spawn(args, {
          stdio: ["inherit", "inherit", "inherit"],
          env: process.env,
        });

        // Wait for the process to exit
        const exitCode = await proc.exited;
        process.exit(exitCode);
      }
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
