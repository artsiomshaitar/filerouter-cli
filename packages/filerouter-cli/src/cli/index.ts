#!/usr/bin/env bun

import { parseArgs } from "util";

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

const VERSION = "0.1.0";

function showHelp() {
  console.log(`
FileRouter CLI v${VERSION}

Usage: filerouter-cli <command> [options]

Commands:
  dev        Start interactive dev mode with hot reload
  generate   Generate commandsTree.gen.ts

Options:
  -c, --commands <dir>   Commands directory (default: ./commands)
  -o, --output <file>    Generated file (default: ./commandsTree.gen.ts)
  -n, --name <name>      CLI name for help generation (default: cli)
  -h, --help             Show this help message
  -v, --version          Show version

Examples:
  filerouter-cli dev
  filerouter-cli generate
  filerouter-cli dev -c ./src/commands -o ./src/commandsTree.gen.ts
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
