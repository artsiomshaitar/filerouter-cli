import { createFileCommand } from "filerouter-cli";
import { authMiddleware } from "../../utils/auth";
// Note: commandInfo will be available from the generated file
// import { commandInfo } from "../../commandsTree.gen";

export const Command = createFileCommand("/_auth")({
  description: "Auth layout - wraps protected commands",
  middleware: [authMiddleware],
  // onError catches errors from the middleware and the handler
  onError: (error) => {
    return `Unauthorized: ${error.message}

Please authenticate first with:
  my-cli auth --username <username> --password <password>`;
  },
  handler: async ({ outlet }) => {
    const childOutput = await outlet;
    return `--- Authenticated Session ---
${childOutput}
--- End Session ---`;
  },
});
