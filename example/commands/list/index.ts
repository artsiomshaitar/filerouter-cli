import { createFileCommand } from "filerouter-cli";
import { z } from "zod";
import { getProjects } from "../../api/projects";

const argsSchema = z.object({
  filter: z.string().optional().describe("Filter projects by name"),
});

// my-cli list
// my-cli list --filter "project1"
// my-cli list -f "project1"

export const Command = createFileCommand("/list")({
  description: "List all projects",
  validateArgs: argsSchema,
  aliases: {
    filter: ["f"],
  },
  handler: async ({ args }) => {
    const { filter } = args;

    const projects = await getProjects(filter);

    if (projects.length === 0) {
      return "No projects found.";
    }

    const list = projects.map((p) => `  - ${p.name} (${p.id})`).join("\n");

    return `Projects:\n${list}`;
  },
});
