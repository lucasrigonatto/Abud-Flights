import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { executeRound } from "../src/domain/execute-round";
import { isDue } from "../src/domain/schedule";
import type { FlightProvider, MonitorCriteria } from "../src/domain/provider";
import { prisma } from "../src/infra/prisma";
import { createPrismaStore } from "../src/infra/prisma-store";
import { createMonitor, getMonitorForUser } from "../src/infra/monitors";
import { runMonitor } from "../src/infra/run-monitor";

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

async function reset() {
  await prisma.notification.deleteMany();
  await prisma.priceObservation.deleteMany();
  await prisma.providerRequest.deleteMany();
  await prisma.monitorSearch.deleteMany();
  await prisma.searchRun.deleteMany();
  await prisma.flightSegment.deleteMany();
  await prisma.itinerary.deleteMany();
  await prisma.searchDefinition.deleteMany();
  await prisma.alertRule.deleteMany();
  await prisma.monitorRevision.deleteMany();
  await prisma.routeDailyStat.deleteMany();
  await prisma.monitor.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
}

const criteria: MonitorCriteria = {
  origins: ["GYN"],
  destinations: ["LIS"],
  dateMode: "FIXED",
  departDate: "2027-09-10",
  returnDate: "2027-09-20",
  flexDays: 0,
  adults: 2,
  childAges: [],
  cabin: "ECONOMY",
  checkedBags: null,
  currency: "BRL",
  market: "BR",
  maxStops: 1,
  maxDurationMinutes: 20 * 60,
};

describeIf("persistência no Postgres", () => {
  beforeEach(async () => {
    await reset();
  });

  afterAll(async () => {
    await reset();
    await prisma.$disconnect();
  });

  it("mantém o monitoramento para outro cliente e esconde da outra conta", async () => {
    const owner = await prisma.user.create({ data: { email: "ana@example.com", name: "Ana", passwordHash: "x" } });
    const other = await prisma.user.create({ data: { email: "bia@example.com", name: "Bia", passwordHash: "x" } });
    const created = await createMonitor(owner.id, {
      criteria,
      name: "Lisboa",
      monitorUntil: "2027-12-01",
      targetAmountMinor: 50_000_000,
      budgetScope: "TOTAL",
    });

    const fresh = new PrismaClient();
    const again = await fresh.monitor.findUnique({ where: { id: created.id } });
    expect(again?.status).toBe("ACTIVE");
    expect(again?.userId).toBe(owner.id);
    expect(isDue({ ...again!, lockedAt: again!.lockedAt }, new Date("2026-11-15T00:00:00.000Z"))).toBe(true);
    expect(await fresh.priceObservation.count({ where: { monitorId: created.id } })).toBeGreaterThan(0);
    expect(await getMonitorForUser(other.id, created.id)).toBeNull();
    expect(await getMonitorForUser(owner.id, created.id)).not.toBeNull();

    const beforeObservations = await prisma.priceObservation.count({ where: { monitorId: created.id } });
    const beforeAlerts = await prisma.notification.count({ where: { monitorId: created.id } });
    const run = await prisma.searchRun.findFirst({ where: { monitorId: created.id } });
    await prisma.monitor.update({
      where: { id: created.id },
      data: { nextRunAt: new Date(), pendingScheduledFor: run?.scheduledFor, lockedAt: null, lockedBy: null },
    });
    await runMonitor(created.id, "test-worker");
    expect(await prisma.priceObservation.count({ where: { monitorId: created.id } })).toBe(beforeObservations);
    expect(await prisma.notification.count({ where: { monitorId: created.id } })).toBe(beforeAlerts);
    await fresh.$disconnect();
  });

  it("grava moeda original e bagagem desconhecida sem tratar falha como ausência de voos", async () => {
    const user = await prisma.user.create({ data: { email: "caro@example.com", name: "Caro", passwordHash: "x" } });
    const store = createPrismaStore(prisma);
    const eur: FlightProvider = {
      id: "stub",
      version: "1",
      allowsCache: false,
      retainsHistory: true,
      cacheTtlMs: 0,
      async search() {
        return {
          offers: [
            {
              providerOfferId: "eur-1",
              priceKind: "DEMONSTRATION",
              totalAmountMinor: 32_150,
              currency: "EUR",
              market: "DE",
              adults: 2,
              childAges: [],
              cabin: "ECONOMY",
              baggage: { known: false, included: true, checkedBags: 1 },
              expiresAt: null,
              link: null,
              stops: 0,
              durationMinutes: 500,
              segments: [
                {
                  origin: "GYN",
                  destination: "LIS",
                  airline: "TP",
                  airlineName: "TAP Air Portugal",
                  flightNumber: "TP9",
                  departLocal: "2027-09-10T09:00:00",
                  arriveLocal: "2027-09-10T18:00:00",
                },
              ],
            },
          ],
        };
      },
    };
    await executeRound(store, eur, {
      userId: user.id,
      monitorId: null,
      filtersVersion: 0,
      scheduledFor: null,
      requestKey: "request-eur-1",
      criteria,
      cursor: 0,
      limit: 8,
      alertRules: [],
      now: new Date("2026-10-29T15:00:00.000Z"),
      budgetRemainingMinor: null,
      costPerSearchMinor: 25,
      sleep: async () => {},
      maxAttempts: 2,
    });
    const saved = await prisma.priceObservation.findFirst({ where: { userId: user.id } });
    expect(saved?.currency).toBe("EUR");
    expect(saved?.totalAmountMinor).toBe(32_150);
    expect(saved?.convertedAmountMinor).toBeNull();
    expect(saved?.convertedCurrency).toBeNull();
    expect(saved?.baggageKnown).toBe(false);
    expect(saved?.baggageIncluded).toBeNull();
    expect(saved?.adults).toBe(2);
    expect(saved?.priceKind).toBe("DEMONSTRATION");

    const failing: FlightProvider = {
      ...eur,
      async search() {
        const { ProviderError } = await import("../src/domain/provider");
        throw new ProviderError("timeout", { temporary: true, code: "TIMEOUT" });
      },
    };
    const failed = await executeRound(store, failing, {
      userId: user.id,
      monitorId: null,
      filtersVersion: 0,
      scheduledFor: null,
      requestKey: "request-fail-1",
      criteria,
      cursor: 0,
      limit: 8,
      alertRules: [],
      now: new Date("2026-10-29T16:00:00.000Z"),
      budgetRemainingMinor: null,
      costPerSearchMinor: 25,
      sleep: async () => {},
      maxAttempts: 2,
    });
    expect(failed.status).toBe("FAILED");
    expect(failed.status).not.toBe("NO_OFFERS");
    const failedRun = await prisma.searchRun.findUnique({ where: { id: failed.runId } });
    expect(failedRun?.status).toBe("FAILED");
    expect(await prisma.priceObservation.count({ where: { searchRunId: failed.runId } })).toBe(0);
  });
});
