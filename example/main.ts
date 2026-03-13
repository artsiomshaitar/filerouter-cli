import { router, parseRoute } from "./commandsTree";
import { ParseError, CommandNotFoundError } from "filerouter-cli";

async function main() {
  try {
    const route = parseRoute(process.argv);
    await router.run(route);
  } catch (error) {
    if (error instanceof ParseError) {
      console.error(`Error: ${error.message}`);
      console.log(`\n${error.help}`);
      process.exit(1);
    }

    if (error instanceof CommandNotFoundError) {
      console.error(`Error: ${error.message}`);
      console.log(`\n${error.help}`);
      process.exit(1);
    }

    // Unknown error
    console.error("Unexpected error:", error);
    process.exit(1);
  }
}

main();
