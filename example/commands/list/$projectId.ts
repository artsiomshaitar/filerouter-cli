import { createFileCommand } from "filerouter-cli";
import { z } from "zod";
import { getProjectById } from "../../api/projects";

const argsSchema = z.object({
  full: z.boolean().default(false).describe("Show full information"),
});

// my-cli list proj_1
// my-cli list proj_1 --full
// my-cli list proj_1 -f

export const Command = createFileCommand("/list/$projectId")({
  description: "Get project info",
  validateArgs: argsSchema,
  aliases: {
    full: ["f"],
  },
  // Simple param descriptions - type-inferred from route path "/list/$projectId"
  paramsDescription: {
    projectId: "Project ID to look up",
  },
  handler: async ({ args, params }) => {
    const { projectId } = params;
    const { full } = args;

    try {
      const { name, details } = await getProjectById(projectId, full);

      let output = `Project: ${name}`;
      if (full && details) {
        output += `\nDetails: ${details}`;
      }
      return output;
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  },
});
