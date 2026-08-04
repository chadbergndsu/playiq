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
  now?: Date;
}): HealthReport {
  const service = input.service ?? "playiq";
  const version = input.version ?? "0.1.0";
  const dbReady = input.dbReady ?? true;
  const timestamp = (input.now ?? new Date()).toISOString();

  const checks: Record<string, "pass" | "fail"> = {
    process: "pass",
    database: dbReady ? "pass" : "fail",
  };

  const failed = Object.values(checks).some((v) => v === "fail");
  const status: HealthStatus = failed ? "degraded" : "ok";

  return { status, service, version, timestamp, checks };
}

export function isHealthy(report: HealthReport): boolean {
  return report.status === "ok";
}
