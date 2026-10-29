import { describe, expect, it } from "vitest";
import { draftsForObservation, meetsTarget, type AlertRuleInput } from "../src/domain/alerts";
import { formatBaggage, normalizeBaggage } from "../src/domain/baggage";
import { coverageMessage } from "../src/domain/coverage";
import { formatConsultation } from "../src/domain/dates";
import { executeRound, type RoundInput } from "../src/domain/execute-round";
import { comparableHistory, classifyHistory, comparabilityKey, type ObservationView } from "../src/domain/history";
import { MemoryStore } from "../src/domain/memory-store";
import { assertCanAccessMonitor, NotFoundError } from "../src/domain/access";
import { isDue } from "../src/domain/schedule";
import type { FlightProvider, MonitorCriteria, ProviderOffer, ProviderQuery } from "../src/domain/provider";
import type { ObservationRecord } from "../src/domain/store";
import { createSimulator } from "../src/providers/simulator";

const NOW = new Date("2026-10-29T15:00:00.000Z");

function criteria(overrides: Partial<MonitorCriteria> = {}): MonitorCriteria {
  return {
    origins: ["GYN"],
    destinations: ["LIS"],
    dateMode: "FIXED",
    departDate: "2027-09-10",
    returnDate: "2027-09-20",
    flexDays: 0,
    adults: 1,
    childAges: [],
    cabin: "ECONOMY",
    checkedBags: 1,
    currency: "BRL",
    market: "BR",
    maxStops: 1,
    maxDurationMinutes: 20 * 60,
    ...overrides,
  };
}

function roundInput(overrides: Partial<RoundInput> = {}): RoundInput {
  const now = overrides.now ?? NOW;
  return {
    userId: "user-a",
    monitorId: "mon-1",
    filtersVersion: 1,
    scheduledFor: now.toISOString(),
    requestKey: null,
    criteria: criteria(),
    cursor: 0,
    limit: 8,
    alertRules: [],
    now,
    budgetRemainingMinor: null,
    costPerSearchMinor: 25,
    sleep: async () => {},
    maxAttempts: 3,
    ...overrides,
  };
}

const openTarget: AlertRuleInput = {
  id: "rule-1",
  type: "TARGET_PRICE",
  targetAmountMinor: 50_000_000,
  currency: "BRL",
  scope: "TOTAL",
  active: true,
};

function view(observation: ObservationRecord): ObservationView {
  return {
    filtersVersion: observation.filtersVersion,
    origin: observation.origin,
    destination: observation.destination,
    departDate: observation.departDate,
    returnDate: observation.returnDate,
    cabin: observation.cabin,
    adults: observation.adults,
    childAges: observation.childAges,
    currency: observation.currency,
    market: observation.market,
    priceKind: observation.priceKind,
    baggageKnown: observation.baggageKnown,
    baggageIncluded: observation.baggageIncluded,
    checkedBags: observation.checkedBags,
    totalAmountMinor: observation.totalAmountMinor,
    collectedAt: observation.collectedAt.toISOString(),
    sourceCollectedAt: observation.sourceCollectedAt.toISOString(),
  };
}

function sampleOffer(overrides: Partial<ProviderOffer> = {}): ProviderOffer {
  return {
    providerOfferId: "eur-offer",
    priceKind: "DEMONSTRATION",
    totalAmountMinor: 32_150,
    currency: "EUR",
    market: "DE",
    adults: 2,
    childAges: [],
    cabin: "ECONOMY",
    baggage: { known: false, included: null, checkedBags: null },
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
        flightNumber: "TP201",
        departLocal: "2027-09-10T09:00:00",
        arriveLocal: "2027-09-10T18:00:00",
      },
    ],
    ...overrides,
  };
}

function stubProvider(search: FlightProvider["search"], overrides: Partial<FlightProvider> = {}): FlightProvider {
  return {
    id: "stub",
    version: "1",
    allowsCache: false,
    retainsHistory: true,
    cacheTtlMs: 0,
    search,
    ...overrides,
  };
}

describe("aceite da primeira versão", () => {
  it("não duplica observações nem alertas quando a mesma rodada é repetida", async () => {
    const store = new MemoryStore();
    const provider = createSimulator();
    const input = roundInput({ alertRules: [openTarget] });

    const first = await executeRound(store, provider, input);
    expect(["SUCCESS", "PARTIAL"]).toContain(first.status);
    expect(store.observations.length).toBeGreaterThan(0);
    expect(store.notifications.length).toBeGreaterThan(0);
    expect(store.notifications.some((notification) => notification.channel === "IN_APP")).toBe(true);
    expect(store.notifications.some((notification) => notification.channel === "EMAIL" && notification.status === "RECORDED")).toBe(true);

    const observations = store.observations.length;
    const notifications = store.notifications.length;
    store.runs[0].status = "PENDING";
    const retried = await executeRound(store, provider, input);
    expect(retried.deduped).toBe(false);
    expect(store.observations).toHaveLength(observations);
    expect(store.notifications).toHaveLength(notifications);

    store.runs[0].status = "SUCCESS";
    const repeated = await executeRound(store, provider, input);
    expect(repeated.deduped).toBe(true);
    expect(store.observations).toHaveLength(observations);
    expect(store.notifications).toHaveLength(notifications);
  });

  it("registra falha de API sem tratá-la como ausência de voos", async () => {
    const store = new MemoryStore();
    const result = await executeRound(store, createSimulator({ mode: "temporary" }), roundInput());

    expect(result.status).toBe("FAILED");
    expect(result.status).not.toBe("NO_OFFERS");
    expect(store.observations).toHaveLength(0);
    expect(store.requests.length).toBeGreaterThan(1);
    expect(store.requests.every((request) => request.status === "error")).toBe(true);
    expect(result.message.toLowerCase()).toContain("não significa que não há voos");
    expect(result.message.toLowerCase()).not.toContain("nenhuma oferta");
  });

  it("distingue consulta vazia de falha", async () => {
    const store = new MemoryStore();
    const provider = stubProvider(async () => ({ offers: [] }));
    const result = await executeRound(store, provider, roundInput());
    expect(result.status).toBe("NO_OFFERS");
    expect(coverageMessage(result).toLowerCase()).toContain("nenhuma oferta");
    expect(coverageMessage(result).toLowerCase()).not.toContain("não significa que não há voos");
  });

  it("não trata bagagem desconhecida como incluída", async () => {
    const normalized = normalizeBaggage({ known: false, included: true, checkedBags: 1 });
    expect(normalized.baggageKnown).toBe(false);
    expect(normalized.baggageIncluded).toBeNull();
    expect(formatBaggage(normalized)).toBe("não informado");

    const searched = await createSimulator().search({
      origin: "GYN",
      destination: "LIS",
      departDate: "2027-09-10",
      returnDate: "2027-09-20",
      adults: 1,
      childAges: [],
      cabin: "ECONOMY",
      checkedBags: 1,
      currency: "BRL",
      market: "BR",
      maxStops: 1,
      maxDurationMinutes: 1200,
    });
    const unknown = searched.offers.find((offer) => offer.baggage.known === false);
    expect(unknown?.baggage.included).toBeNull();

    const store = new MemoryStore();
    await executeRound(store, createSimulator(), roundInput());
    const stored = store.observations.filter((observation) => observation.baggageKnown === false);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.every((observation) => observation.baggageIncluded === null)).toBe(true);
    expect(stored.every((observation) => formatBaggage(observation) === "não informado")).toBe(true);
  });

  it("preserva o valor e a moeda originais da oferta", async () => {
    const store = new MemoryStore();
    const provider = stubProvider(async () => ({ offers: [sampleOffer()] }));
    await executeRound(store, provider, roundInput({ criteria: criteria({ currency: "BRL" }) }));

    expect(store.observations).toHaveLength(1);
    expect(store.observations[0].currency).toBe("EUR");
    expect(store.observations[0].totalAmountMinor).toBe(32_150);
    expect(store.observations[0].priceKind).toBe("DEMONSTRATION");
  });

  it("usa o preço total da oferta de dois passageiros", async () => {
    const provider = createSimulator();
    const query: ProviderQuery = {
      origin: "GYN",
      destination: "LIS",
      departDate: "2027-09-10",
      returnDate: "2027-09-20",
      adults: 1,
      childAges: [],
      cabin: "ECONOMY",
      checkedBags: 1,
      currency: "BRL",
      market: "BR",
      maxStops: 1,
      maxDurationMinutes: 1200,
    };
    const one = await provider.search(query);
    const two = await provider.search({ ...query, adults: 2 });
    expect(two.offers.length).toBe(one.offers.length);
    for (let index = 0; index < one.offers.length; index += 1) {
      expect(two.offers[index].adults).toBe(2);
      expect(two.offers[index].totalAmountMinor).toBe(one.offers[index].totalAmountMinor * 2);
    }

    const single = new MemoryStore();
    const pair = new MemoryStore();
    await executeRound(single, provider, roundInput({ criteria: criteria({ adults: 1 }), monitorId: "one" }));
    await executeRound(pair, provider, roundInput({ criteria: criteria({ adults: 2 }), monitorId: "two" }));
    expect(pair.observations.every((observation) => observation.adults === 2)).toBe(true);
    for (const observation of pair.observations) {
      const match = single.observations.find(
        (item) => item.itineraryKey === observation.itineraryKey && item.baggageKnown === observation.baggageKnown,
      );
      expect(match).toBeTruthy();
      expect(observation.totalAmountMinor).toBe(match!.totalAmountMinor * 2);
      expect(observation.totalAmountMinor).not.toBe(match!.totalAmountMinor);
    }

    expect(
      meetsTarget(
        { totalAmountMinor: 400_000, currency: "BRL", adults: 2 },
        { targetAmountMinor: 200_000, currency: "BRL", scope: "TOTAL" },
      ),
    ).toBe(false);
    expect(
      meetsTarget(
        { totalAmountMinor: 400_000, currency: "BRL", adults: 2 },
        { targetAmountMinor: 400_000, currency: "BRL", scope: "TOTAL" },
      ),
    ).toBe(true);
  });

  it("indica quando parte das combinações ficou sem consulta", async () => {
    const store = new MemoryStore();
    const result = await executeRound(
      store,
      createSimulator(),
      roundInput({
        limit: 2,
        criteria: criteria({
          origins: ["GYN", "BSB"],
          destinations: ["LIS", "OPO"],
          dateMode: "FLEX",
          flexDays: 3,
        }),
      }),
    );

    expect(result.combinationsPlanned).toBeGreaterThan(result.combinationsQueried);
    expect(result.status).toBe("PARTIAL");
    expect(result.message.toLowerCase()).toContain("menor preço entre as opções consultadas");
    expect(result.message.toLowerCase()).toContain("parte das combinações ficou sem consulta");
  });

  it("mantém históricos incompatíveis separados quando os filtros mudam", async () => {
    const store = new MemoryStore();
    const provider = createSimulator();
    const firstAt = new Date("2026-10-01T15:00:00.000Z");
    const secondAt = new Date("2026-10-02T15:00:00.000Z");
    await executeRound(
      store,
      provider,
      roundInput({
        now: firstAt,
        scheduledFor: firstAt.toISOString(),
        filtersVersion: 1,
        criteria: criteria({ adults: 1 }),
      }),
    );
    await executeRound(
      store,
      provider,
      roundInput({
        now: secondAt,
        scheduledFor: secondAt.toISOString(),
        filtersVersion: 2,
        criteria: criteria({ adults: 2 }),
      }),
    );

    const views = store.observations.map(view);
    expect(views.some((observation) => observation.filtersVersion === 1)).toBe(true);
    expect(views.some((observation) => observation.filtersVersion === 2)).toBe(true);
    const currentSample = views.find((observation) => observation.filtersVersion === 2);
    expect(currentSample).toBeTruthy();
    const current = comparableHistory(views, 2, comparabilityKey(currentSample!));
    expect(current.length).toBeGreaterThan(0);
    expect(current.every((observation) => observation.filtersVersion === 2 && observation.adults === 2)).toBe(true);
    expect(classifyHistory(current).label.toLowerCase()).toContain("histórico insuficiente");

    const mixedMin = Math.min(...views.map((observation) => observation.totalAmountMinor));
    const currentMin = Math.min(...current.map((observation) => observation.totalAmountMinor));
    expect(currentMin).not.toBe(mixedMin);
  });

  it("mostra histórico insuficiente sem amostra bastante e classifica quando a amostra basta", () => {
    expect(classifyHistory([]).label.toLowerCase()).toContain("histórico insuficiente");

    const enough: ObservationView[] = [1, 2, 3, 4, 5, 6].map((index) => ({
      filtersVersion: 1,
      origin: "GYN",
      destination: "LIS",
      departDate: index % 2 === 0 ? "2027-09-10" : "2027-09-12",
      returnDate: "2027-09-20",
      cabin: "ECONOMY",
      adults: 1,
      childAges: [],
      currency: "BRL",
      market: "BR",
      priceKind: "DEMONSTRATION",
      baggageKnown: true,
      baggageIncluded: true,
      checkedBags: 1,
      totalAmountMinor: 300_000 + index * 10_000,
      collectedAt: `2026-10-0${1 + (index % 3)}T12:00:00.000Z`,
      sourceCollectedAt: `2026-10-0${1 + (index % 3)}T12:00:00.000Z`,
    }));
    const reading = classifyHistory(enough);
    expect(reading.classification).not.toBe("historico_insuficiente");
    expect(reading.label.toLowerCase()).not.toContain("histórico insuficiente");

    const unknown: ObservationView = {
      ...enough[0],
      baggageKnown: false,
      baggageIncluded: null,
      checkedBags: null,
      totalAmountMinor: 50_000,
      collectedAt: "2026-10-04T12:00:00.000Z",
      sourceCollectedAt: "2026-10-04T12:00:00.000Z",
    };
    const unknownGroup = comparableHistory([...enough, unknown], 1, comparabilityKey(unknown));
    expect(unknownGroup).toHaveLength(1);
    expect(classifyHistory(unknownGroup).label.toLowerCase()).toContain("histórico insuficiente");
  });

  it("mostra a data da consulta original quando o preço vem do cache", async () => {
    const store = new MemoryStore();
    const provider = createSimulator();
    const firstAt = new Date("2026-03-01T15:00:00.000Z");
    const secondAt = new Date(firstAt.getTime() + 5 * 60 * 1000);
    await executeRound(
      store,
      provider,
      roundInput({ now: firstAt, scheduledFor: firstAt.toISOString(), monitorId: "mon-a", userId: "user-a" }),
    );
    await executeRound(
      store,
      provider,
      roundInput({ now: secondAt, scheduledFor: secondAt.toISOString(), monitorId: "mon-b", userId: "user-b" }),
    );

    const reused = store.observations.filter((observation) => observation.monitorId === "mon-b");
    expect(reused.length).toBeGreaterThan(0);
    expect(reused.every((observation) => observation.fromCache)).toBe(true);
    expect(reused.every((observation) => observation.sourceCollectedAt.getTime() === firstAt.getTime())).toBe(true);
    expect(formatConsultation(reused[0].sourceCollectedAt)).toContain("Consultado em");
    expect(formatConsultation(reused[0].sourceCollectedAt)).toContain("01/03/2026");
  });

  it("isola o acesso ao monitoramento da conta dona", () => {
    expect(() => assertCanAccessMonitor("user-a", { userId: "user-a" })).not.toThrow();
    expect(() => assertCanAccessMonitor("user-b", { userId: "user-a" })).toThrow(NotFoundError);
  });

  it("reencontra monitoramentos vencidos sem depender de memória do processo", () => {
    const now = new Date("2026-10-29T15:00:00.000Z");
    const due = isDue(
      {
        status: "ACTIVE",
        nextRunAt: new Date("2026-10-29T12:00:00.000Z"),
        monitorUntil: new Date("2027-01-01T00:00:00.000Z"),
        lockedAt: null,
      },
      now,
    );
    expect(due).toBe(true);
    expect(
      isDue(
        {
          status: "PAUSED",
          nextRunAt: new Date("2026-10-29T12:00:00.000Z"),
          monitorUntil: new Date("2027-01-01T00:00:00.000Z"),
          lockedAt: null,
        },
        now,
      ),
    ).toBe(false);
  });

  it("não alerta de novo a mesma oferta e o mesmo preço", () => {
    const observation = {
      id: "obs-1",
      itineraryKey: "flight-1",
      totalAmountMinor: 400_000,
      currency: "BRL",
      adults: 2,
      priceKind: "DEMONSTRATION" as const,
      origin: "GYN",
      destination: "LIS",
      departDate: "2027-09-10",
      returnDate: "2027-09-20",
      sourceCollectedAt: NOW,
      filtersVersion: 1,
      baggageKnown: true,
      baggageIncluded: true,
      checkedBags: 1,
    };
    const first = draftsForObservation({
      observation,
      rules: [openTarget],
      userId: "user-a",
      monitorId: "mon-1",
    });
    const second = draftsForObservation({
      observation,
      rules: [openTarget],
      userId: "user-a",
      monitorId: "mon-1",
    });
    expect(first.map((draft) => draft.dedupKey)).toEqual(second.map((draft) => draft.dedupKey));
    expect(first.every((draft) => draft.body.toLowerCase().includes("preço de demonstração"))).toBe(true);
  });
});
