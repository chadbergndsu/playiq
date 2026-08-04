import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildHealthReport, isHealthy } from "./health";

describe("buildHealthReport", () => {
  it("returns ok when all checks pass", () => {
    const report = buildHealthReport({
      service: "playiq",
      version: "0.1.0",
      dbReady: true,
      now: new Date("2026-08-03T12:00:00.000Z"),
    });

    assert.equal(report.status, "ok");
    assert.equal(report.service, "playiq");
    assert.equal(report.checks.process, "pass");
    assert.equal(report.checks.database, "pass");
    assert.equal(isHealthy(report), true);
  });

  it("returns degraded when database is not ready", () => {
    const report = buildHealthReport({ dbReady: false });
    assert.equal(report.status, "degraded");
    assert.equal(report.checks.database, "fail");
    assert.equal(isHealthy(report), false);
  });
});
