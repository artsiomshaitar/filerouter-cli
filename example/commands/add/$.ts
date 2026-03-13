import { createFileCommand } from "filerouter-cli";
import { z } from "zod";

const argsSchema = z.object({
  // Boolean flags
  dev: z.boolean().default(false).describe("Add as dev dependency"),
  exact: z.boolean().default(false).describe("Use exact version"),
  global: z.boolean().default(false).describe("Install globally"),
});

// Test commands:
// my-cli add typescript          -> should parse as: dev=false, _splat=["typescript"]
// my-cli add -D typescript       -> should parse as: dev=true, _splat=["typescript"]
// my-cli add --dev typescript    -> should parse as: dev=true, _splat=["typescript"]
// my-cli add typescript -D       -> should parse as: dev=true, _splat=["typescript"]
// my-cli add -D -E typescript    -> should parse as: dev=true, exact=true, _splat=["typescript"]
// my-cli add typescript react    -> should parse as: _splat=["typescript", "react"]

export const Command = createFileCommand("/add/$")({
  description: "Add packages (splat route example)",
  validateArgs: argsSchema,
  aliases: {
    dev: ["D"],
    exact: ["E"],
    global: ["g"],
  },
  // Simple param descriptions - type-inferred from route path "/add/$"
  paramsDescription: {
    _splat: "Packages to install",
  },
  handler: async ({ args, params }) => {
    const { dev, exact, global: isGlobal } = args;
    const packages = params._splat;

    const flags: string[] = [];
    if (dev) flags.push("--save-dev");
    if (exact) flags.push("--save-exact");
    if (isGlobal) flags.push("--global");

    return `Adding packages: ${packages.join(", ")}\nFlags: ${flags.join(" ") || "(none)"}`;
  },
});
