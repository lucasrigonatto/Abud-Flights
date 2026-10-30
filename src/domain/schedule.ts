import { LIMITS } from "./limits";

export type MonitorLifecycle = "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";

export type DueMonitor = {
  status: MonitorLifecycle;
  nextRunAt: Date;
  monitorUntil: Date;
  lockedAt: Date | null;
};

export function isDue(monitor: DueMonitor, now: Date, lockTimeoutMs = LIMITS.lockTimeoutMs): boolean {
  if (monitor.status !== "ACTIVE") return false;
  if (monitor.monitorUntil.getTime() < now.getTime()) return false;
  if (monitor.nextRunAt.getTime() > now.getTime()) return false;
  if (monitor.lockedAt && now.getTime() - monitor.lockedAt.getTime() < lockTimeoutMs) return false;
  return true;
}

export function nextRegularRun(scheduledFor: Date, intervalHours: number): Date {
  return new Date(scheduledFor.getTime() + intervalHours * 60 * 60 * 1000);
}

export function failureRetryAt(now: Date, attempt: number): Date {
  const minutes = [15, 30, 60, 120][Math.max(0, attempt - 1)] ?? 120;
  return new Date(now.getTime() + minutes * 60 * 1000);
}
