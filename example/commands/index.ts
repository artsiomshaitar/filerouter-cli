import { createFileCommand, runCommand } from "filerouter-cli";

// my-cli

export const Command = createFileCommand("/")({
  description: "Root command - runs list command",
  handler: async () => {
    // Type-safe runCommand with required params
    return runCommand("/list/$projectId", { params: { projectId: "default" } });
  },
});
