import type { Monitor, AlertRule } from "@prisma/client";
import { toAlertRule } from "../domain/alerts";
import { executeRound } from "../domain/execute-round";
import type { PriorSample } from "../domain/exploration";
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
  return alertRules.filter((rule) => rule.active && rule.type !== "DAILY_DIGEST").map((rule) => toAlertRule(rule));
}

async function ensureNewLow(monitor: Monitor & { alertRules: AlertRule[] }): Promise<AlertRule[]> {
  if (monitor.alertRules.some((rule) => rule.type === "NEW_LOW")) return monitor.alertRules;
  const created = await prisma.alertRule.create({
    data: {
      monitorId: monitor.id,
      type: "NEW_LOW",
      targetAmountMinor: 0,
      currency: monitor.currency,
      scope: "TOTAL",
      active: true,
    },
  });
  return [...monitor.alertRules, created];
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

  const monitor = await prisma.monitor.findUnique({
    where: { id },
    include: { alertRules: true, groundCosts: true, user: true },
  });
  if (!monitor) return false;
  const alertRules = await ensureNewLow(monitor);
  const priorRows = await prisma.priceObservation.findMany({
    where: { monitorId: monitor.id, filtersVersion: monitor.filtersVersion },
    orderBy: { sourceCollectedAt: "asc" },
    take: 500,
  });
  const priorSamples: PriorSample[] = priorRows.map((row) => ({
    origin: row.origin,
    destination: row.destination,
    departDate: isoFromUtcDate(row.departDate),
    returnDate: isoFromUtcDate(row.returnDate),
    priceKind: row.priceKind,
    totalAmountMinor: row.totalAmountMinor,
    collectedAt: row.sourceCollectedAt.toISOString(),
    currency: row.currency,
  }));
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
      alertRules: rulesFrom(alertRules),
      now,
      budgetRemainingMinor: await providerBudgetRemaining(now),
      costPerSearchMinor: LIMITS.costPerSearchMinor,
      maxAttempts: LIMITS.providerRetryAttempts,
      priorSamples,
      groundCosts: monitor.groundCosts.map((cost) => ({
        airport: cost.airport,
        transferMinor: cost.transferAmountMinor,
        lodgingMinor: cost.lodgingAmountMinor,
        feesMinor: cost.feesAmountMinor,
        transferMinutes: cost.transferMinutes,
      })),
      extraBagAmountMinor: monitor.extraBagAmountMinor,
      quietStartHour: monitor.user.quietStartHour,
      quietEndHour: monitor.user.quietEndHour,
      digestEnabled: monitor.user.digestEnabled,
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
