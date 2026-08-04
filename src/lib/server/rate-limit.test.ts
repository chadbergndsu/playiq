import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkRateLimit,
  clientKey,
  resetRateLimitsForTests,
} from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows up to limit then blocks", () => {
    resetRateLimitsForTests();
    const now = 1_000_000;
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit("t:a", { limit: 3, windowMs: 60_000, now });
      assert.equal(r.ok, true);
    }
    const blocked = checkRateLimit("t:a", { limit: 3, windowMs: 60_000, now });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.ok(blocked.retryAfterSec >= 1);
  });

  it("resets after window", () => {
    resetRateLimitsForTests();
    const now = 1_000_000;
    checkRateLimit("t:b", { limit: 1, windowMs: 1000, now });
    const blocked = checkRateLimit("t:b", { limit: 1, windowMs: 1000, now });
    assert.equal(blocked.ok, false);
    const ok = checkRateLimit("t:b", {
      limit: 1,
      windowMs: 1000,
      now: now + 1001,
    });
    assert.equal(ok.ok, true);
  });
});

describe("clientKey", () => {
  it("prefers x-forwarded-for first hop", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    assert.equal(clientKey(req, "share"), "share:1.2.3.4");
  });
});
