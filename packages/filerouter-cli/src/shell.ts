import type { ShellFn } from "./types";

/**
 * Shell execution helper.
 *
 * Uses Bun.$ when available (Bun runtime), otherwise throws an error.
 * In the future, we could add a Node.js fallback using child_process.
 */
export function getShell(): ShellFn {
  if (typeof Bun !== "undefined" && Bun.$) {
    return Bun.$;
  }

  // For now, throw an error if Bun.$ is not available
  // In the future, we could implement a lightweight fallback
  throw new Error(
    "Shell execution requires Bun runtime. " +
      "Make sure you're running with `bun` instead of `node`."
  );
}

/**
 * The shell execution function ($).
 * Pre-initialized for convenience.
 */
export const $: ShellFn = getShell();
