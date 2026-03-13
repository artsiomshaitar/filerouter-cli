import type { Middleware } from "./types";
import { MiddlewareError } from "./errors";

/**
 * Execute a chain of middleware functions
 *
 * Each middleware receives the context and a next function.
 * Calling next() continues to the next middleware.
 * Not calling next() short-circuits the chain.
 */
export async function executeMiddleware<TContext>(
  middleware: Middleware<TContext>[],
  context: TContext,
  finalHandler: () => Promise<void>
): Promise<void> {
  let index = 0;

  const next = async (): Promise<void> => {
    if (index < middleware.length) {
      const currentMiddleware = middleware[index];
      index++;
      try {
        await currentMiddleware(context, next);
      } catch (error) {
        throw new MiddlewareError(
          `Middleware error: ${(error as Error).message}`,
          error as Error
        );
      }
    } else {
      // All middleware executed, run the final handler
      await finalHandler();
    }
  };

  await next();
}

/**
 * Create a middleware that checks a condition
 *
 * @example
 * ```ts
 * const authMiddleware = createGuard(
 *   (ctx) => ctx.isAuthenticated,
 *   () => { throw new Error("Unauthorized"); }
 * );
 * ```
 */
export function createGuard<TContext>(
  check: (context: TContext) => boolean | Promise<boolean>,
  onFail: (context: TContext) => void | never
): Middleware<TContext> {
  return async (context, next) => {
    const passed = await check(context);
    if (!passed) {
      onFail(context);
      return; // Don't continue if onFail didn't throw
    }
    await next();
  };
}
