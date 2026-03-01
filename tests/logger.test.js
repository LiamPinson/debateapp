// ============================================================
// Logger Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { log } from "@/lib/logger";

describe("logger", () => {
  it("exports debug, info, warn, error methods", () => {
    expect(typeof log.debug).toBe("function");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
  });

  it("warn and error are not no-ops (always active)", () => {
    // In test env, warn and error should always be callable (bound to console)
    // They should not be the noop function
    expect(log.warn).not.toBe(log.debug); // debug may be noop in non-dev
    expect(log.error).not.toBe(log.debug);
  });

  it("does not throw when called", () => {
    // Ensure all methods can be called without crashing
    expect(() => log.debug("test")).not.toThrow();
    expect(() => log.info("test")).not.toThrow();
    expect(() => log.warn("test")).not.toThrow();
    expect(() => log.error("test")).not.toThrow();
  });
});
