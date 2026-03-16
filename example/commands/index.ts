import { createFileCommand, runCommand } from "filerouter-cli";

// my-cli

export const Command = createFileCommand("/")({
  description: "Root command - shows help",
  handler: async ({ context }) => {
    context.logger.debug("Running root command");
    return "Run with --help to see available commands";
  },
});
