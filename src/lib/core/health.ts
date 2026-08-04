/**
 * Pure health helpers — kept framework-free so CI can unit-test them.
 */

export type HealthStatus = "ok" | "degraded" | "down";

export type HealthReport = {
  status: HealthStatus;
  service: string;
  version: string;
  timestamp: string;
  checks: Record<string, "pass" | "fail">;
};

export function buildHealthReport(input: {
  service?: string;
  version?: string;
  dbReady?: boolean;
  /** Whether XAI_API_KEY is set (informational; missing does not degrade). */
  xaiConfigured?: boolean;
  now?: Date;
}): HealthReport {
  const service = input.service ?? "playiq";
  const version = input.version ?? "1.1.0";
  const dbReady = input.dbReady ?? true;
  const timestamp = (input.now ?? new Date()).toISOString();

  const checks: Record<string, "pass" | "fail"> = {
    process: "pass",
    database: dbReady ? "pass" : "fail",
    // Informational only for ops — demos run fine without a key.
    xai: input.xaiConfigured ? "pass" : "fail",
  };

  // Only process + database affect service status (xai is optional).
  const criticalFailed =
    checks.process === "fail" || checks.database === "fail";
  const status: HealthStatus = criticalFailed ? "degraded" : "ok";

  return { status, service, version, timestamp, checks };
}

export function isHealthy(report: HealthReport): boolean {
  return report.status === "ok";
}
