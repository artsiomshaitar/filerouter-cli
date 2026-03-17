import type { ShellFn } from "./types";

/**
 * Shell execution helper.
 *
 * Returns Bun.$ when available, otherwise throws.
 */
export function getShell(): ShellFn {
  if (typeof Bun !== "undefined" && Bun.$) {
    return Bun.$;
  }

  throw new Error(
    "Shell execution requires Bun runtime. " +
      "Make sure you're running with `bun` instead of `node`.",
  );
}
