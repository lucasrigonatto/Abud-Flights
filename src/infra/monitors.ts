import { Prisma, type Monitor } from "@prisma/client";
import { draftsForObservation } from "../domain/alerts";
import { executeRound } from "../domain/execute-round";
import { LIMITS } from "../domain/limits";
import type { MonitorCriteria } from "../domain/provider";
import { endOfSaoPauloDay, isoFromUtcDate } from "../domain/dates";
import { getProvider } from "../providers";
import { providerBudgetRemaining } from "./budget";
import { prisma } from "./prisma";
import { createPrismaStore } from "./prisma-store";
import { criteriaFromMonitor, runMonitor } from "./run-monitor";

export type MonitorDraft = {
  criteria: MonitorCriteria;
  name: string;
  monitorUntil: string;
  targetAmountMinor: number;
  budgetScope: "TOTAL" | "PER_PERSON";
};

function revisionData(monitorId: string, filtersVersion: number, criteria: MonitorCriteria) {
  return {
    monitorId,
    filtersVersion,
    origins: criteria.origins,
    destinations: criteria.destinations,
    dateMode: criteria.dateMode,
    departDate: new Date(`${criteria.departDate}T00:00:00.000Z`),
    returnDate: new Date(`${criteria.returnDate}T00:00:00.000Z`),
    flexDays: criteria.flexDays,
    adults: criteria.adults,
    childAges: criteria.childAges,
    cabin: criteria.cabin,
    checkedBags: criteria.checkedBags,
    currency: criteria.currency,
    market: criteria.market,
    maxStops: criteria.maxStops,
    maxDurationMinutes: criteria.maxDurationMinutes,
  };
}

export async function createMonitor(userId: string, draft: MonitorDraft): Promise<Monitor> {
  const active = await prisma.monitor.count({ where: { userId, status: "ACTIVE" } });
  if (active >= LIMITS.maxActiveMonitorsPerUser) {
    throw new Error(`Você já tem ${LIMITS.maxActiveMonitorsPerUser} monitoramentos ativos. Pause um para criar outro.`);
  }
  const now = new Date();
  const monitor = await prisma.$transaction(async (tx) => {
    const created = await tx.monitor.create({
      data: {
        userId,
        name: draft.name,
        status: "ACTIVE",
        origins: draft.criteria.origins,
        destinations: draft.criteria.destinations,
        dateMode: draft.criteria.dateMode,
        departDate: new Date(`${draft.criteria.departDate}T00:00:00.000Z`),
        returnDate: new Date(`${draft.criteria.returnDate}T00:00:00.000Z`),
        flexDays: draft.criteria.flexDays,
        adults: draft.criteria.adults,
        childAges: draft.criteria.childAges,
        cabin: draft.criteria.cabin,
        checkedBags: draft.criteria.checkedBags,
        maxStops: draft.criteria.maxStops,
        maxDurationMinutes: draft.criteria.maxDurationMinutes,
        currency: draft.criteria.currency,
        market: draft.criteria.market,
        monitorUntil: endOfSaoPauloDay(draft.monitorUntil),
        intervalHours: LIMITS.intervalHours,
        nextRunAt: now,
        filtersVersion: 1,
      },
    });
    await tx.monitorRevision.create({ data: revisionData(created.id, 1, draft.criteria) });
    await tx.alertRule.create({
      data: {
        monitorId: created.id,
        type: "TARGET_PRICE",
        targetAmountMinor: draft.targetAmountMinor,
        currency: draft.criteria.currency,
        scope: draft.budgetScope,
        active: true,
      },
    });
    return created;
  });
  try {
    await runMonitor(monitor.id, `web-${process.pid}`, now);
  } catch (error) {
    console.error("primeira rodada falhou", error);
  }
  return monitor;
}

export async function runAdhocSearch(userId: string, criteria: MonitorCriteria, requestKey: string) {
  const now = new Date();
  return executeRound(createPrismaStore(prisma), getProvider(), {
    userId,
    monitorId: null,
    filtersVersion: 0,
    scheduledFor: null,
    requestKey,
    criteria,
    cursor: 0,
    limit: LIMITS.maxCombinationsPerRound,
    alertRules: [],
    now,
    budgetRemainingMinor: await providerBudgetRemaining(now),
    costPerSearchMinor: LIMITS.costPerSearchMinor,
    maxAttempts: LIMITS.providerRetryAttempts,
  });
}

export async function getMonitorForUser(userId: string, monitorId: string) {
  return prisma.monitor.findFirst({ where: { id: monitorId, userId } });
}

function sameCriteria(monitor: Monitor, criteria: MonitorCriteria): boolean {
  return (
    monitor.origins.join(",") === criteria.origins.join(",") &&
    monitor.destinations.join(",") === criteria.destinations.join(",") &&
    monitor.dateMode === criteria.dateMode &&
    isoFromUtcDate(monitor.departDate) === criteria.departDate &&
    isoFromUtcDate(monitor.returnDate) === criteria.returnDate &&
    monitor.flexDays === criteria.flexDays &&
    monitor.adults === criteria.adults &&
    monitor.childAges.join(",") === criteria.childAges.join(",") &&
    monitor.cabin === criteria.cabin &&
    monitor.checkedBags === criteria.checkedBags &&
    monitor.currency === criteria.currency &&
    monitor.market === criteria.market &&
    monitor.maxStops === criteria.maxStops &&
    monitor.maxDurationMinutes === criteria.maxDurationMinutes
  );
}

export async function updateMonitor(userId: string, monitorId: string, draft: MonitorDraft): Promise<void> {
  const monitor = await getMonitorForUser(userId, monitorId);
  if (!monitor || monitor.status === "CANCELLED" || monitor.status === "COMPLETED") {
    throw new Error("Monitoramento não encontrado.");
  }
  const criteriaChanged = !sameCriteria(monitor, draft.criteria);
  const currentRule = await prisma.alertRule.findFirst({ where: { monitorId: monitor.id, type: "TARGET_PRICE" } });
  const targetChanged =
    !currentRule ||
    currentRule.targetAmountMinor !== draft.targetAmountMinor ||
    currentRule.scope !== draft.budgetScope ||
    currentRule.currency !== draft.criteria.currency;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const nextVersion = criteriaChanged ? monitor.filtersVersion + 1 : monitor.filtersVersion;
    await tx.monitor.update({
      where: { id: monitor.id },
      data: {
        name: draft.name,
        origins: draft.criteria.origins,
        destinations: draft.criteria.destinations,
        dateMode: draft.criteria.dateMode,
        departDate: new Date(`${draft.criteria.departDate}T00:00:00.000Z`),
        returnDate: new Date(`${draft.criteria.returnDate}T00:00:00.000Z`),
        flexDays: draft.criteria.flexDays,
        adults: draft.criteria.adults,
        childAges: draft.criteria.childAges,
        cabin: draft.criteria.cabin,
        checkedBags: draft.criteria.checkedBags,
        maxStops: draft.criteria.maxStops,
        maxDurationMinutes: draft.criteria.maxDurationMinutes,
        currency: draft.criteria.currency,
        market: draft.criteria.market,
        monitorUntil: endOfSaoPauloDay(draft.monitorUntil),
        filtersVersion: nextVersion,
        explorationCursor: criteriaChanged ? 0 : monitor.explorationCursor,
        pendingScheduledFor: criteriaChanged ? null : monitor.pendingScheduledFor,
        nextRunAt: criteriaChanged ? now : monitor.nextRunAt,
        lockedAt: null,
        lockedBy: null,
      },
    });
    if (criteriaChanged) {
      await tx.monitorRevision.create({ data: revisionData(monitor.id, nextVersion, draft.criteria) });
    }
    await tx.alertRule.updateMany({
      where: { monitorId: monitor.id, type: "TARGET_PRICE" },
      data: {
        targetAmountMinor: draft.targetAmountMinor,
        currency: draft.criteria.currency,
        scope: draft.budgetScope,
        active: true,
      },
    });
  });
  if (criteriaChanged && monitor.status === "ACTIVE") {
    try {
      await runMonitor(monitor.id, `web-${process.pid}`, now);
    } catch (error) {
      console.error("rodada após mudança de filtros falhou", error);
    }
    return;
  }
  if (targetChanged) await notifyCurrentOffers(userId, monitorId);
}

export async function setMonitorStatus(userId: string, monitorId: string, status: "ACTIVE" | "PAUSED" | "CANCELLED") {
  const monitor = await getMonitorForUser(userId, monitorId);
  if (!monitor) throw new Error("Monitoramento não encontrado.");
  if (monitor.status === "CANCELLED" || monitor.status === "COMPLETED") {
    throw new Error("Esse monitoramento já foi encerrado.");
  }
  const now = new Date();
  await prisma.monitor.update({
    where: { id: monitor.id },
    data: {
      status,
      lockedAt: null,
      lockedBy: null,
      nextRunAt: status === "ACTIVE" && monitor.nextRunAt.getTime() < now.getTime() ? now : monitor.nextRunAt,
    },
  });
  if (status === "ACTIVE") {
    try {
      await runMonitor(monitor.id, `web-${process.pid}`, now);
    } catch (error) {
      console.error("retomada do monitoramento falhou", error);
    }
  }
}

export async function notifyCurrentOffers(userId: string, monitorId: string) {
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, userId },
    include: { alertRules: true, runs: { orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (!monitor) return;
  const latest = monitor.runs[0];
  if (!latest) return;
  const observations = await prisma.priceObservation.findMany({
    where: { monitorId, searchRunId: latest.id, userId },
    include: { itinerary: true },
  });
  for (const observation of observations) {
    const drafts = draftsForObservation({
      observation: {
        id: observation.id,
        itineraryKey: observation.itinerary.key,
        totalAmountMinor: observation.totalAmountMinor,
        currency: observation.currency,
        adults: observation.adults,
        priceKind: observation.priceKind,
        origin: observation.origin,
        destination: observation.destination,
        departDate: isoFromUtcDate(observation.departDate),
        returnDate: isoFromUtcDate(observation.returnDate),
        sourceCollectedAt: observation.sourceCollectedAt,
        filtersVersion: observation.filtersVersion ?? monitor.filtersVersion,
        baggageKnown: observation.baggageKnown,
        baggageIncluded: observation.baggageIncluded,
        checkedBags: observation.checkedBags,
      },
      rules: monitor.alertRules.map((rule) => ({
        id: rule.id,
        type: "TARGET_PRICE" as const,
        targetAmountMinor: rule.targetAmountMinor,
        currency: rule.currency,
        scope: rule.scope,
        active: rule.active,
      })),
      userId,
      monitorId,
    });
    for (const draft of drafts) {
      try {
        await prisma.notification.create({ data: draft });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      }
    }
  }
}
