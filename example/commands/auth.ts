import { createFileCommand } from "filerouter-cli";
import { z } from "zod";
import { login } from "../utils/auth";

const argsSchema = z.object({
  username: z.string().describe("Username"),
  password: z.string().describe("Password"),
});

// my-cli auth --username "username" --password "password"
// my-cli auth -u "username" -p "password"

export const Command = createFileCommand("/auth")({
  description: "Authorize in the my-cli",
  validateArgs: argsSchema,
  aliases: {
    username: ["u"],
    password: ["p"],
  },
  handler: async ({ args }) => {
    const { username, password } = args;

    const { name, id } = await login(username, password);

    return `Logged in as ${name} with id ${id}`;
  },
});
