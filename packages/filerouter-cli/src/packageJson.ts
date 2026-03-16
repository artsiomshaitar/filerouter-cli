import * as fs from "fs";
import * as path from "path";

/**
 * Find and read the user's package.json from the current working directory
 * Searches up from cwd to find the nearest package.json
 */
export function getProjectName(): string {
  try {
    let dir = process.cwd();
    while (dir !== path.dirname(dir)) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name && typeof pkg.name === "string") {
          return pkg.name;
        }
        break;
      }
      dir = path.dirname(dir);
    }
    return "cli";
  } catch {
    return "cli";
  }
}
