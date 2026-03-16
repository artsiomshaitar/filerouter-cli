import { createFileCommand, commandInfo } from "filerouter-cli";
import { authMiddleware } from "../../utils/auth";

export const Command = createFileCommand("/_auth")({
  description: "Auth layout - wraps protected commands",
  middleware: [authMiddleware],
  // onError catches errors from the middleware and the handler
  onError: (error) => {
    return `Unauthorized: ${error.message}

Please authenticate first with:
  ${commandInfo("/auth").usage()}`;
  },
  handler: async ({ outlet }) => {
    const childOutput = await outlet;
    return `--- Authenticated Session ---
${childOutput}
--- End Session ---`;
  },
});
