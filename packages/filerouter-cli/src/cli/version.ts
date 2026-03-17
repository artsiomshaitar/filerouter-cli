import * as path from "path";
import { fileURLToPath } from "url";
import { findNearestPackageJson } from "../packageJson";

export function getVersion(): string {
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pkg = findNearestPackageJson(__dirname, (p) => p.name === "filerouter-cli");
    return (pkg?.version as string) ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
