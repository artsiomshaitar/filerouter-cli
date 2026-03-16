import React from "react";
import { render } from "ink";
import { DevMode } from "./components/DevMode.js";

export interface DevOptions {
  commandsDirectory: string;
  generatedFile: string;
  entryPoint: string;
}

export async function runDev(options: DevOptions): Promise<void> {
  // Check if we're in a TTY environment
  if (!process.stdin.isTTY) {
    console.error(`
Error: Interactive dev mode requires a TTY environment.

This happens when:
  - Running in a non-interactive shell (CI, piped input, etc.)
  - Running through certain terminal wrappers

Solutions:
  - Run directly in a terminal: bun filerouter-cli dev main.ts
  - Use 'generate' command for non-interactive use: filerouter-cli generate
`);
    process.exit(1);
  }

  const { waitUntilExit } = render(
    <DevMode
      commandsDirectory={options.commandsDirectory}
      generatedFile={options.generatedFile}
      entryPoint={options.entryPoint}
    />
  );

  await waitUntilExit();
}
