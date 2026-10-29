import type { Monitor, AlertRule } from "@prisma/client";
import { executeRound } from "../domain/execute-round";
import { LIMITS } from "../domain/limits";
import type { MonitorCriteria } from "../domain/provider";
import { failureRetryAt, isDue, nextRegularRun } from "../domain/schedule";
import { isoFromUtcDate } from "../domain/dates";
import { getProvider } from "../providers";
import { providerBudgetRemaining } from "./budget";
import { prisma } from "./prisma";
import { createPrismaStore } from "./prisma-store";

export function criteriaFromMonitor(monitor: Monitor): MonitorCriteria {
  return {
    origins: monitor.origins,
    destinations: monitor.destinations,
    dateMode: monitor.dateMode,
    departDate: isoFromUtcDate(monitor.departDate),
    returnDate: isoFromUtcDate(monitor.returnDate),
    flexDays: monitor.flexDays,
    adults: monitor.adults,
    childAges: monitor.childAges,
    cabin: monitor.cabin,
    checkedBags: monitor.checkedBags,
    currency: monitor.currency,
    market: monitor.market,
    maxStops: monitor.maxStops,
    maxDurationMinutes: monitor.maxDurationMinutes,
  };
}

function rulesFrom(alertRules: AlertRule[]) {
  return alertRules
    .filter((rule) => rule.active && rule.type === "TARGET_PRICE")
    .map((rule) => ({
      id: rule.id,
      type: "TARGET_PRICE" as const,
      targetAmountMinor: rule.targetAmountMinor,
      currency: rule.currency,
      scope: rule.scope,
      active: rule.active,
    }));
}

export async function runMonitor(id: string, workerId: string, now = new Date()): Promise<boolean> {
  const lockCutoff = new Date(now.getTime() - LIMITS.lockTimeoutMs);
  const claimed = await prisma.monitor.updateMany({
    where: {
      id,
      status: "ACTIVE",
      nextRunAt: { lte: now },
      monitorUntil: { gte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: lockCutoff } }],
    },
    data: { lockedAt: now, lockedBy: workerId },
  });
  if (claimed.count !== 1) return false;

  const monitor = await prisma.monitor.findUnique({ where: { id }, include: { alertRules: true } });
  if (!monitor) return false;
  const slot = monitor.pendingScheduledFor ?? monitor.nextRunAt;
  if (!monitor.pendingScheduledFor) {
    await prisma.monitor.update({ where: { id }, data: { pendingScheduledFor: slot } });
  }

  try {
    const result = await executeRound(createPrismaStore(prisma), getProvider(), {
      userId: monitor.userId,
      monitorId: monitor.id,
      filtersVersion: monitor.filtersVersion,
      scheduledFor: slot.toISOString(),
      requestKey: null,
      criteria: criteriaFromMonitor(monitor),
      cursor: monitor.explorationCursor,
      limit: LIMITS.maxCombinationsPerRound,
      alertRules: rulesFrom(monitor.alertRules),
      now,
      budgetRemainingMinor: await providerBudgetRemaining(now),
      costPerSearchMinor: LIMITS.costPerSearchMinor,
      maxAttempts: LIMITS.providerRetryAttempts,
    });

    if (result.datesPassed) {
      await prisma.monitor.update({
        where: { id },
        data: {
          status: "COMPLETED",
          pendingScheduledFor: null,
          lockedAt: null,
          lockedBy: null,
          explorationCursor: result.nextCursor,
        },
      });
      return true;
    }

    if (result.status === "FAILED" && result.attempt < LIMITS.roundRetryAttempts) {
      await prisma.monitor.update({
        where: { id },
        data: {
          pendingScheduledFor: slot,
          nextRunAt: failureRetryAt(now, result.attempt),
          failureCount: { increment: 1 },
          lockedAt: null,
          lockedBy: null,
        },
      });
      return true;
    }

    await prisma.monitor.update({
      where: { id },
      data: {
        pendingScheduledFor: null,
        nextRunAt: nextRegularRun(slot, monitor.intervalHours),
        explorationCursor: result.nextCursor,
        failureCount: result.status === "FAILED" ? { increment: 1 } : 0,
        lockedAt: null,
        lockedBy: null,
      },
    });
    return true;
  } catch (error) {
    await prisma.monitor.update({
      where: { id },
      data: { lockedAt: null, lockedBy: null, nextRunAt: new Date(now.getTime() + 5 * 60 * 1000) },
    });
    throw error;
  }
}

export async function runDueMonitors(workerId: string, now = new Date()): Promise<number> {
  await prisma.monitor.updateMany({
    where: { status: "ACTIVE", monitorUntil: { lt: now } },
    data: { status: "COMPLETED", lockedAt: null, lockedBy: null },
  });
  const candidates = await prisma.monitor.findMany({
    where: {
      status: "ACTIVE",
      nextRunAt: { lte: now },
      monitorUntil: { gte: now },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - LIMITS.lockTimeoutMs) } }],
    },
    orderBy: { nextRunAt: "asc" },
    take: 10,
  });
  let processed = 0;
  for (const candidate of candidates) {
    if (!isDue(candidate, now)) continue;
    if (await runMonitor(candidate.id, workerId, now)) processed += 1;
  }
  return processed;
}
