import { createFileCommand } from "filerouter-cli";

// my-cli

export const Command = createFileCommand("/")({
  description: "Root command - redirects to list",
  handler: async ({ redirect }) => {
    return redirect("/list");
  },
});
