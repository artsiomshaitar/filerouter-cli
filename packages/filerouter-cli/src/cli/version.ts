import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * Get the version from package.json
 * Searches up from the current module to find package.json
 */
export function getVersion(): string {
  try {
    // Get the directory of this file
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    // Search up for package.json
    let dir = __dirname;
    while (dir !== path.dirname(dir)) {
      const pkgPath = path.join(dir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "filerouter-cli") {
          return pkg.version || "0.0.0";
        }
      }
      dir = path.dirname(dir);
    }
    
    return "0.0.0";
  } catch {
    return "0.0.0";
  }
}
