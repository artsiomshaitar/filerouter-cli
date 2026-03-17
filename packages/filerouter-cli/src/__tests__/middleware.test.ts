import { describe, expect, it } from "bun:test";
import { MiddlewareError } from "../errors";
import { createGuard, executeMiddleware } from "../middleware";
import type { Middleware } from "../types";

describe("executeMiddleware", () => {
  it("executes empty middleware array", async () => {
    let handlerCalled = false;
    await executeMiddleware([], {}, async () => {
      handlerCalled = true;
    });
    expect(handlerCalled).toBe(true);
  });

  it("executes single middleware", async () => {
    const order: string[] = [];

    const middleware: Middleware = async (_ctx, next) => {
      order.push("middleware");
      await next();
    };

    await executeMiddleware([middleware], {}, async () => {
      order.push("handler");
    });

    expect(order).toEqual(["middleware", "handler"]);
  });

  it("executes multiple middleware in order", async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push("mw1-start");
      await next();
      order.push("mw1-end");
    };

    const mw2: Middleware = async (_ctx, next) => {
      order.push("mw2-start");
      await next();
      order.push("mw2-end");
    };

    const mw3: Middleware = async (_ctx, next) => {
      order.push("mw3-start");
      await next();
      order.push("mw3-end");
    };

    await executeMiddleware([mw1, mw2, mw3], {}, async () => {
      order.push("handler");
    });

    expect(order).toEqual([
      "mw1-start",
      "mw2-start",
      "mw3-start",
      "handler",
      "mw3-end",
      "mw2-end",
      "mw1-end",
    ]);
  });

  it("middleware can short-circuit by not calling next", async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push("mw1");
      await next();
    };

    const mw2: Middleware = async (_ctx, _next) => {
      order.push("mw2-short-circuit");
      // Not calling next()
    };

    const mw3: Middleware = async (_ctx, next) => {
      order.push("mw3");
      await next();
    };

    await executeMiddleware([mw1, mw2, mw3], {}, async () => {
      order.push("handler");
    });

    expect(order).toEqual(["mw1", "mw2-short-circuit"]);
  });

  it("async middleware waits correctly", async () => {
    const order: string[] = [];

    const slowMiddleware: Middleware = async (_ctx, next) => {
      order.push("slow-start");
      await new Promise((resolve) => setTimeout(resolve, 50));
      order.push("slow-middle");
      await next();
      order.push("slow-end");
    };

    await executeMiddleware([slowMiddleware], {}, async () => {
      order.push("handler");
    });

    expect(order).toEqual(["slow-start", "slow-middle", "handler", "slow-end"]);
  });

  it("wraps middleware errors in MiddlewareError", async () => {
    const errorMiddleware: Middleware = async (_ctx, _next) => {
      throw new Error("middleware error");
    };

    await expect(executeMiddleware([errorMiddleware], {}, async () => {})).rejects.toThrow(
      MiddlewareError,
    );
  });

  it("MiddlewareError contains original error", async () => {
    const originalError = new Error("original");
    const errorMiddleware: Middleware = async (_ctx, _next) => {
      throw originalError;
    };

    try {
      await executeMiddleware([errorMiddleware], {}, async () => {});
    } catch (e) {
      expect(e).toBeInstanceOf(MiddlewareError);
      expect((e as MiddlewareError).originalError).toBe(originalError);
    }
  });

  it("middleware receives context", async () => {
    let receivedContext: any = null;

    const middleware: Middleware = async (ctx, next) => {
      receivedContext = ctx;
      await next();
    };

    const context = { user: { id: "123" }, token: "abc" };
    await executeMiddleware([middleware], context, async () => {});

    expect(receivedContext).toEqual(context);
  });

  it("middleware can modify context", async () => {
    let finalContext: any = null;

    const addUserMiddleware: Middleware<{ user?: { id: string } }> = async (ctx, next) => {
      ctx.user = { id: "123" };
      await next();
    };

    const checkUserMiddleware: Middleware<{ user?: { id: string } }> = async (ctx, next) => {
      finalContext = { ...ctx };
      await next();
    };

    await executeMiddleware(
      [addUserMiddleware, checkUserMiddleware],
      {} as { user?: { id: string } },
      async () => {},
    );

    expect(finalContext).toEqual({ user: { id: "123" } });
  });

  it("errors propagate through middleware chain", async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push("mw1-start");
      try {
        await next();
      } catch (e) {
        order.push("mw1-catch");
        throw e;
      }
      order.push("mw1-end");
    };

    const mw2: Middleware = async (_ctx, _next) => {
      order.push("mw2-throw");
      throw new Error("test error");
    };

    try {
      await executeMiddleware([mw1, mw2], {}, async () => {
        order.push("handler");
      });
    } catch (_e) {
      // Expected
    }

    expect(order).toEqual(["mw1-start", "mw2-throw", "mw1-catch"]);
  });
});

describe("createGuard", () => {
  it("passes when check returns true", async () => {
    const guard = createGuard(
      async () => true,
      async () => {
        throw new Error("should not be called");
      },
    );

    let handlerCalled = false;
    await executeMiddleware([guard], {}, async () => {
      handlerCalled = true;
    });

    expect(handlerCalled).toBe(true);
  });

  it("calls onFail when check returns false", async () => {
    let onFailCalled = false;

    const guard = createGuard(
      async () => false,
      async () => {
        onFailCalled = true;
      },
    );

    await executeMiddleware([guard], {}, async () => {});

    expect(onFailCalled).toBe(true);
  });

  it("short-circuits when check fails and onFail returns", async () => {
    let handlerCalled = false;

    const guard = createGuard(
      async () => false,
      async () => {
        // Return normally, causing short-circuit
      },
    );

    await executeMiddleware([guard], {}, async () => {
      handlerCalled = true;
    });

    expect(handlerCalled).toBe(false);
  });

  it("propagates error when onFail throws", async () => {
    const guard = createGuard(
      async () => false,
      () => {
        throw new Error("access denied");
      },
    );

    // createGuard wraps in MiddlewareError
    await expect(executeMiddleware([guard], {}, async () => {})).rejects.toThrow(MiddlewareError);
  });

  it("works with sync check function", async () => {
    let handlerCalled = false;

    const guard = createGuard(
      () => true, // Sync function
      async () => {},
    );

    await executeMiddleware([guard], {}, async () => {
      handlerCalled = true;
    });

    expect(handlerCalled).toBe(true);
  });

  it("check function receives context", async () => {
    let receivedContext: any = null;

    const guard = createGuard(
      async (ctx) => {
        receivedContext = ctx;
        return true;
      },
      async () => {},
    );

    const context = { user: { role: "admin" } };
    await executeMiddleware([guard], context, async () => {});

    expect(receivedContext).toEqual(context);
  });

  it("onFail receives context", async () => {
    let receivedContext: any = null;

    const guard = createGuard(
      async () => false,
      async (ctx) => {
        receivedContext = ctx;
      },
    );

    const context = { user: { role: "guest" } };
    await executeMiddleware([guard], context, async () => {});

    expect(receivedContext).toEqual(context);
  });

  it("works in middleware chain", async () => {
    const order: string[] = [];

    const logMiddleware: Middleware = async (_ctx, next) => {
      order.push("log-start");
      await next();
      order.push("log-end");
    };

    const authGuard = createGuard(
      async (ctx: { authenticated?: boolean }) => ctx.authenticated === true,
      () => {
        order.push("auth-failed");
      },
    );

    // Test with authenticated user
    await executeMiddleware([logMiddleware, authGuard], { authenticated: true }, async () => {
      order.push("handler");
    });

    expect(order).toEqual(["log-start", "handler", "log-end"]);

    // Test with unauthenticated user
    // When guard fails and returns (doesn't throw), the middleware chain continues to unwind
    // because createGuard returns early but logMiddleware still completes its "after" phase
    order.length = 0;
    await executeMiddleware([logMiddleware, authGuard], { authenticated: false }, async () => {
      order.push("handler");
    });

    // logMiddleware wraps authGuard, so when authGuard returns early (short-circuits),
    // logMiddleware's "log-end" still runs
    expect(order).toEqual(["log-start", "auth-failed", "log-end"]);
  });

  it("multiple guards in sequence", async () => {
    const order: string[] = [];

    const authGuard = createGuard(
      async () => {
        order.push("auth-check");
        return true;
      },
      async () => {
        order.push("auth-fail");
      },
    );

    const roleGuard = createGuard(
      async () => {
        order.push("role-check");
        return true;
      },
      async () => {
        order.push("role-fail");
      },
    );

    await executeMiddleware([authGuard, roleGuard], {}, async () => {
      order.push("handler");
    });

    expect(order).toEqual(["auth-check", "role-check", "handler"]);
  });

  it("first failing guard stops execution", async () => {
    const order: string[] = [];

    const authGuard = createGuard(
      async () => {
        order.push("auth-check");
        return false;
      },
      async () => {
        order.push("auth-fail");
      },
    );

    const roleGuard = createGuard(
      async () => {
        order.push("role-check");
        return true;
      },
      async () => {
        order.push("role-fail");
      },
    );

    await executeMiddleware([authGuard, roleGuard], {}, async () => {
      order.push("handler");
    });

    expect(order).toEqual(["auth-check", "auth-fail"]);
  });
});
