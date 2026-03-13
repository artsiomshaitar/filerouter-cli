import { createFileCommand } from "filerouter-cli";

// my-cli protected
// This command is wrapped by the _auth layout, so it requires authentication

export const Command = createFileCommand("/_auth/protected")({
  description: "A protected command that requires authentication",
  handler: async () => {
    return "Executing protected operation...\nSuccess! Secret data: 42";
  },
});
