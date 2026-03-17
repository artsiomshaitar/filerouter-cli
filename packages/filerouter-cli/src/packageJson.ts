import * as fs from "fs";
import * as path from "path";

/**
 * Walk up from `startDir` looking for a package.json that satisfies `predicate`.
 * Returns the parsed JSON object or `null` if none matched.
 */
export function findNearestPackageJson(
  startDir: string,
  predicate: (pkg: Record<string, unknown>) => boolean = () => true,
): Record<string, unknown> | null {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (predicate(pkg)) return pkg;
    }
    dir = path.dirname(dir);
  }
  return null;
}

export function getProjectName(): string {
  try {
    const pkg = findNearestPackageJson(
      process.cwd(),
      (p) => typeof p.name === "string" && p.name.length > 0,
    );
    return (pkg?.name as string) ?? "cli";
  } catch {
    return "cli";
  }
}
