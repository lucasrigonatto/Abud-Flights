import { Prisma, type Monitor } from "@prisma/client";
import { draftsForObservation, toAlertRule } from "../domain/alerts";
import type { PriorSample } from "../domain/exploration";
import { compareAlternate, quoteRoute, type AirportCost } from "../domain/trip-cost";
import { executeRound } from "../domain/execute-round";
import { LIMITS } from "../domain/limits";
import type { MonitorCriteria } from "../domain/provider";
import { endOfSaoPauloDay, isoFromUtcDate } from "../domain/dates";
import { getProvider } from "../providers";
import { providerBudgetRemaining } from "./budget";
import { prisma } from "./prisma";
import { createPrismaStore } from "./prisma-store";
import { criteriaFromMonitor, runMonitor } from "./run-monitor";

export type GroundCostDraft = {
  airport: string;
  transferAmountMinor: number | null;
  transferMinutes: number | null;
  lodgingAmountMinor: number | null;
  feesAmountMinor: number | null;
};

export type MonitorDraft = {
  criteria: MonitorCriteria;
  name: string;
  monitorUntil: string;
  targetAmountMinor: number;
  budgetScope: "TOTAL" | "PER_PERSON";
  percentPoints: number | null;
  minSavingsMinor: number | null;
  newLow: boolean;
  extraBagAmountMinor: number | null;
  groundCosts: GroundCostDraft[];
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
        extraBagAmountMinor: draft.extraBagAmountMinor,
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
    await tx.alertRule.create({
      data: {
        monitorId: created.id,
        type: "NEW_LOW",
        targetAmountMinor: 0,
        currency: draft.criteria.currency,
        scope: "TOTAL",
        active: draft.newLow,
      },
    });
    if (draft.percentPoints !== null) {
      await tx.alertRule.create({
        data: {
          monitorId: created.id,
          type: "PERCENT_DROP",
          targetAmountMinor: 0,
          percentPoints: draft.percentPoints,
          currency: draft.criteria.currency,
          scope: draft.budgetScope,
          active: true,
        },
      });
    }
    if (draft.minSavingsMinor !== null) {
      await tx.alertRule.create({
        data: {
          monitorId: created.id,
          type: "ALTERNATE_SAVINGS",
          targetAmountMinor: 0,
          minSavingsMinor: draft.minSavingsMinor,
          currency: draft.criteria.currency,
          scope: "TOTAL",
          active: true,
        },
      });
    }
    if (draft.groundCosts.length > 0) {
      await tx.groundCost.createMany({
        data: draft.groundCosts.map((cost) => ({ monitorId: created.id, ...cost })),
      });
    }
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

async function syncOptionalRule(
  tx: Prisma.TransactionClient,
  monitorId: string,
  type: "PERCENT_DROP" | "ALTERNATE_SAVINGS" | "NEW_LOW",
  currency: string,
  data: { percentPoints?: number; minSavingsMinor?: number; active?: boolean } | null,
) {
  const existing = await tx.alertRule.findFirst({ where: { monitorId, type } });
  if (data === null) {
    if (existing) await tx.alertRule.delete({ where: { id: existing.id } });
    return;
  }
  const next = {
    currency,
    targetAmountMinor: 0,
    scope: "TOTAL" as const,
    active: data.active ?? true,
    percentPoints: data.percentPoints ?? null,
    minSavingsMinor: data.minSavingsMinor ?? null,
  };
  if (existing) await tx.alertRule.update({ where: { id: existing.id }, data: next });
  else await tx.alertRule.create({ data: { monitorId, type, ...next } });
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
  const rules = await prisma.alertRule.findMany({ where: { monitorId: monitor.id } });
  const currentRule = rules.find((rule) => rule.type === "TARGET_PRICE");
  const percentRule = rules.find((rule) => rule.type === "PERCENT_DROP");
  const savingsRule = rules.find((rule) => rule.type === "ALTERNATE_SAVINGS");
  const newLowRule = rules.find((rule) => rule.type === "NEW_LOW");
  const targetChanged =
    !currentRule ||
    currentRule.targetAmountMinor !== draft.targetAmountMinor ||
    currentRule.scope !== draft.budgetScope ||
    currentRule.currency !== draft.criteria.currency ||
    percentRule?.percentPoints !== draft.percentPoints ||
    (draft.percentPoints === null) !== !percentRule ||
    savingsRule?.minSavingsMinor !== draft.minSavingsMinor ||
    (draft.minSavingsMinor === null) !== !savingsRule ||
    newLowRule?.active !== draft.newLow;
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
        extraBagAmountMinor: draft.extraBagAmountMinor,
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
    await syncOptionalRule(tx, monitor.id, "PERCENT_DROP", draft.criteria.currency, draft.percentPoints === null ? null : { percentPoints: draft.percentPoints });
    await syncOptionalRule(tx, monitor.id, "ALTERNATE_SAVINGS", draft.criteria.currency, draft.minSavingsMinor === null ? null : { minSavingsMinor: draft.minSavingsMinor });
    await syncOptionalRule(tx, monitor.id, "NEW_LOW", draft.criteria.currency, { active: draft.newLow });
    await tx.groundCost.deleteMany({ where: { monitorId: monitor.id } });
    if (draft.groundCosts.length > 0) {
      await tx.groundCost.createMany({
        data: draft.groundCosts.map((cost) => ({ monitorId: monitor.id, ...cost })),
      });
    }
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
    include: {
      alertRules: true,
      groundCosts: true,
      user: true,
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  if (!monitor) return;
  const latest = monitor.runs[0];
  if (!latest) return;
  const [observations, priorRows] = await Promise.all([
    prisma.priceObservation.findMany({
      where: { monitorId, searchRunId: latest.id, userId },
      include: { itinerary: true },
    }),
    prisma.priceObservation.findMany({
      where: { monitorId, filtersVersion: monitor.filtersVersion, searchRunId: { not: latest.id } },
      orderBy: { sourceCollectedAt: "asc" },
      take: 500,
    }),
  ]);
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
  const groundCosts: AirportCost[] = monitor.groundCosts.map((cost) => ({
    airport: cost.airport,
    transferMinor: cost.transferAmountMinor,
    lodgingMinor: cost.lodgingAmountMinor,
    feesMinor: cost.feesAmountMinor,
    transferMinutes: cost.transferMinutes,
  }));
  const seen = observations.map((observation) => ({
    origin: observation.origin,
    destination: observation.destination,
    totalAmountMinor: observation.totalAmountMinor,
    currency: observation.currency,
    priceKind: observation.priceKind,
    durationMinutes: observation.itinerary.durationMinutes,
    baggageKnown: observation.baggageKnown,
    baggageIncluded: observation.baggageIncluded,
    checkedBags: observation.checkedBags,
  }));
  for (const observation of observations) {
    const routePrior = priorSamples.filter(
      (sample) =>
        sample.currency === observation.currency &&
        sample.priceKind === observation.priceKind &&
        sample.origin === observation.origin &&
        sample.destination === observation.destination,
    );
    const kindPrior = priorSamples.filter(
      (sample) => sample.currency === observation.currency && sample.priceKind === observation.priceKind,
    );
    const previous = routePrior.at(-1);
    const primaryOrigin = monitor.origins[0];
    const primaryDestination = monitor.destinations[0];
    let netSavingsMinor: number | null = null;
    let extraMinutes: number | null = null;
    if (observation.origin !== primaryOrigin || observation.destination !== primaryDestination) {
      const primary = seen
        .filter(
          (item) =>
            item.origin === primaryOrigin &&
            item.destination === primaryDestination &&
            item.currency === observation.currency &&
            item.priceKind !== "LIVE_INDICATIVE",
        )
        .sort((left, right) => left.totalAmountMinor - right.totalAmountMinor)[0];
      if (primary && observation.priceKind !== "LIVE_INDICATIVE") {
        const compared = compareAlternate(
          quoteRoute({
            fareMinor: primary.totalAmountMinor,
            origin: primary.origin,
            destination: primary.destination,
            durationMinutes: primary.durationMinutes,
            requiredBags: monitor.checkedBags,
            baggageKnown: primary.baggageKnown,
            baggageIncluded: primary.baggageIncluded,
            includedBags: primary.checkedBags,
            extraBagAmountMinor: monitor.extraBagAmountMinor,
            costs: groundCosts,
          }),
          quoteRoute({
            fareMinor: observation.totalAmountMinor,
            origin: observation.origin,
            destination: observation.destination,
            durationMinutes: observation.itinerary.durationMinutes,
            requiredBags: monitor.checkedBags,
            baggageKnown: observation.baggageKnown,
            baggageIncluded: observation.baggageIncluded,
            includedBags: observation.checkedBags,
            extraBagAmountMinor: monitor.extraBagAmountMinor,
            costs: groundCosts,
          }),
          observation.currency,
        );
        netSavingsMinor = compared.savingsMinor;
        extraMinutes = compared.extraTravelMinutes;
      }
    }
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
      rules: monitor.alertRules.filter((rule) => rule.type !== "DAILY_DIGEST").map((rule) => toAlertRule(rule)),
      userId,
      monitorId,
      context: {
        previousAmountMinor: previous?.totalAmountMinor ?? null,
        lowestAmountMinor: kindPrior.length ? Math.min(...kindPrior.map((sample) => sample.totalAmountMinor)) : null,
        netSavingsMinor,
        extraMinutes,
        now: new Date(),
        quietStartHour: monitor.user.quietStartHour,
        quietEndHour: monitor.user.quietEndHour,
        digestEnabled: monitor.user.digestEnabled,
      },
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
