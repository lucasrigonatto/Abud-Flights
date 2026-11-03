import { describe, expect, it } from "vitest";
import { draftsForObservation, type AlertRuleInput } from "../src/domain/alerts";
import { buildCombinations, selectRoundSlice } from "../src/domain/combinations";
import { coverageMessage } from "../src/domain/coverage";
import { planFlexibleRound } from "../src/domain/exploration";
import { chartSegments, classifyHistory, dateMatrix, groupComparable, lowestByCollectionDay, type ObservationView } from "../src/domain/history";
import type { MonitorCriteria } from "../src/domain/provider";
import { baggageCostMinor, compareAlternate, formatCost, quoteRoute, totalCost, UNKNOWN_COST_LABEL } from "../src/domain/trip-cost";
import { describeTripLink } from "../src/domain/trip-link";

const NOW = new Date("2026-10-29T15:00:00.000Z");

function observation(overrides: Partial<ObservationView> = {}): ObservationView {
  return {
    filtersVersion: 1,
    origin: "GYN",
    destination: "LIS",
    departDate: "2027-09-10",
    returnDate: "2027-09-20",
    cabin: "ECONOMY",
    adults: 1,
    childAges: [],
    currency: "BRL",
    market: "BR",
    priceKind: "DEMONSTRATION",
    baggageKnown: true,
    baggageIncluded: true,
    checkedBags: 0,
    totalAmountMinor: 80_000,
    collectedAt: "2026-10-01T12:00:00.000Z",
    sourceCollectedAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

function alertObservation(amount: number) {
  return {
    id: "obs-1",
    itineraryKey: "flight-1",
    totalAmountMinor: amount,
    currency: "BRL",
    adults: 1,
    priceKind: "DEMONSTRATION" as const,
    origin: "BSB",
    destination: "LIS",
    departDate: "2027-09-10",
    returnDate: "2027-09-20",
    sourceCollectedAt: NOW,
    filtersVersion: 1,
    baggageKnown: true,
    baggageIncluded: true,
    checkedBags: 0,
  };
}

const costs = {
  known: [
    { airport: "GYN", transferMinor: 0, lodgingMinor: 0, feesMinor: 0, transferMinutes: 30 },
    { airport: "LIS", transferMinor: 0, lodgingMinor: 0, feesMinor: 0, transferMinutes: 40 },
    { airport: "BSB", transferMinor: 5_000, lodgingMinor: 0, feesMinor: 0, transferMinutes: 90 },
  ],
};

describe("custo real da alternativa", () => {
  it("não transforma valor desconhecido em zero", () => {
    const total = totalCost({ fareMinor: 10_000, baggageMinor: null, transferMinor: 0, lodgingMinor: 0, feesMinor: 0 });
    expect(total).toBeNull();
    expect(total).not.toBe(0);
    expect(total).not.toBe(10_000);
    expect(formatCost(total, "BRL")).toBe(UNKNOWN_COST_LABEL);
    expect(
      baggageCostMinor({
        requiredBags: 1,
        baggageKnown: false,
        baggageIncluded: null,
        includedBags: null,
        extraBagAmountMinor: 5_000,
      }),
    ).toBeNull();

    const primary = quoteRoute({
      fareMinor: 80_000,
      origin: "GYN",
      destination: "LIS",
      durationMinutes: 600,
      requiredBags: 0,
      baggageKnown: true,
      baggageIncluded: true,
      includedBags: 0,
      extraBagAmountMinor: null,
      costs: costs.known,
    });
    const unknownAlternate = quoteRoute({
      fareMinor: 70_000,
      origin: "BSB",
      destination: "LIS",
      durationMinutes: 640,
      requiredBags: 0,
      baggageKnown: true,
      baggageIncluded: true,
      includedBags: 0,
      extraBagAmountMinor: null,
      costs: [
        { airport: "BSB", transferMinor: null, lodgingMinor: 0, feesMinor: 0, transferMinutes: 90 },
        costs.known[1],
      ],
    });
    const blocked = compareAlternate(primary, unknownAlternate, "BRL");
    expect(blocked.savingsMinor).toBeNull();
    expect(blocked.cheaperAfterCosts).toBe(false);
    expect(blocked.summary.toLowerCase()).toContain("não informado");
    expect(totalCost(unknownAlternate)).not.toBe(70_000);

    const cheaper = quoteRoute({
      fareMinor: 70_000,
      origin: "BSB",
      destination: "LIS",
      durationMinutes: 640,
      requiredBags: 0,
      baggageKnown: true,
      baggageIncluded: true,
      includedBags: 0,
      extraBagAmountMinor: null,
      costs: costs.known,
    });
    const saved = compareAlternate(primary, cheaper, "BRL");
    expect(saved.cheaperAfterCosts).toBe(true);
    expect(saved.savingsMinor).toBe(5_000);
    expect(saved.summary).toContain("Economia estimada");
    expect(saved.summary).toContain("Tempo extra");
    expect(saved.extraTravelMinutes).toBeGreaterThan(0);

    const fareOnly = quoteRoute({
      fareMinor: 70_000,
      origin: "BSB",
      destination: "LIS",
      durationMinutes: 640,
      requiredBags: 0,
      baggageKnown: true,
      baggageIncluded: true,
      includedBags: 0,
      extraBagAmountMinor: null,
      costs: [
        { airport: "BSB", transferMinor: 20_000, lodgingMinor: 0, feesMinor: 0, transferMinutes: 90 },
        costs.known[1],
      ],
    });
    const notCheaper = compareAlternate(primary, fareOnly, "BRL");
    expect(notCheaper.cheaperAfterCosts).toBe(false);
    expect(notCheaper.summary).toContain("A tarifa isolada é menor");
  });
});

describe("histórico legível", () => {
  it("pede mais amostra e trata lacuna como ausência, não como zero", () => {
    expect(classifyHistory([observation()]).label).toContain("Histórico insuficiente");
    const series = [
      observation({ collectedAt: "2026-10-01T12:00:00.000Z", totalAmountMinor: 90_000 }),
      observation({ collectedAt: "2026-10-01T18:00:00.000Z", totalAmountMinor: 80_000 }),
      observation({ collectedAt: "2026-10-03T12:00:00.000Z", totalAmountMinor: 70_000 }),
    ];
    const points = lowestByCollectionDay(series);
    expect(points).toEqual([
      { day: "2026-10-01", amountMinor: 80_000 },
      { day: "2026-10-03", amountMinor: 70_000 },
    ]);
    expect(points.some((point) => point.amountMinor === 0)).toBe(false);
    expect(chartSegments(points)).toHaveLength(2);

    const matrix = dateMatrix([
      observation({ departDate: "2027-09-10", returnDate: "2027-09-20", totalAmountMinor: 80_000 }),
      observation({ departDate: "2027-09-12", returnDate: "2027-09-22", totalAmountMinor: 90_000 }),
    ]);
    expect(matrix.amounts.flat()).toContain(null);
    expect(matrix.amounts.flat()).not.toContain(0);
    expect(matrix.amounts.flat()).toContain(80_000);

    const groups = groupComparable(
      [
        observation({ priceKind: "DEMONSTRATION", totalAmountMinor: 80_000 }),
        observation({ priceKind: "LIVE_INDICATIVE", totalAmountMinor: 10 }),
      ],
      1,
    );
    expect(groups).toHaveLength(2);
    expect(groups.find((group) => group.observations[0]?.priceKind === "DEMONSTRATION")?.observations).toHaveLength(1);
    expect(groups.find((group) => group.observations[0]?.priceKind === "LIVE_INDICATIVE")?.reading.label).toContain("Histórico insuficiente");
  });
});

describe("flexibilidade com teto", () => {
  it("mantém a frase de cobertura parcial e o limite da rodada", () => {
    const message = coverageMessage({ status: "PARTIAL", combinationsPlanned: 12, combinationsQueried: 2 });
    expect(message).toContain("Menor preço entre as opções consultadas.");
    expect(message).toContain("Parte das combinações ficou sem consulta.");

    const criteria: MonitorCriteria = {
      origins: ["GYN", "BSB"],
      destinations: ["LIS", "OPO"],
      dateMode: "FLEX",
      departDate: "2027-09-10",
      returnDate: "2027-09-20",
      flexDays: 3,
      adults: 1,
      childAges: [],
      cabin: "ECONOMY",
      checkedBags: 1,
      currency: "BRL",
      market: "BR",
      maxStops: 1,
      maxDurationMinutes: 20 * 60,
    };
    const combinations = buildCombinations(criteria, "2026-10-29");
    expect(combinations.length).toBeGreaterThan(2);
    const baseline = selectRoundSlice(combinations, 0, 2);
    const withoutHistory = planFlexibleRound(combinations, 0, 2, []);
    expect(withoutHistory.queried).toEqual(baseline.queried);
    expect(withoutHistory.nextCursor).toBe(baseline.nextCursor);
    expect(withoutHistory.partial).toBe(true);
    expect(withoutHistory.queried).toHaveLength(2);

    const known = combinations[3] ?? combinations[0];
    const withHistory = planFlexibleRound(combinations, 0, 2, [
      {
        ...known,
        priceKind: "DEMONSTRATION",
        totalAmountMinor: 50_000,
        collectedAt: "2026-10-01T12:00:00.000Z",
        currency: "BRL",
      },
    ]);
    expect(withHistory.queried.length).toBeLessThanOrEqual(2);
    expect(withHistory.queried.length).toBeGreaterThan(0);
    expect(withHistory.partial).toBe(true);
    expect(withHistory.confirmation.some((combo) => combo.origin === known.origin && combo.departDate === known.departDate)).toBe(true);
    expect(withHistory.queried).toHaveLength(2);
  });
});

describe("alertas sem duplicata", () => {
  const target: AlertRuleInput = {
    id: "target",
    type: "TARGET_PRICE",
    targetAmountMinor: 100_000,
    currency: "BRL",
    scope: "TOTAL",
    active: true,
  };

  it("não emite o mesmo alerta duas vezes e ignora economia desconhecida", () => {
    const first = draftsForObservation({
      observation: alertObservation(80_000),
      rules: [target],
      userId: "user-a",
      monitorId: "mon-1",
    });
    const second = draftsForObservation({
      observation: alertObservation(80_000),
      rules: [target],
      userId: "user-a",
      monitorId: "mon-1",
    });
    expect(first.map((draft) => draft.dedupKey)).toEqual(second.map((draft) => draft.dedupKey));
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((draft) => draft.body.includes("Preço de demonstração"))).toBe(true);
    expect(first.every((draft) => draft.body.includes("Consultado em"))).toBe(true);
    const dropped = draftsForObservation({
      observation: alertObservation(70_000),
      rules: [target],
      userId: "user-a",
      monitorId: "mon-1",
    });
    expect(dropped[0]?.dedupKey).not.toBe(first[0]?.dedupKey);

    const unknownSavings = draftsForObservation({
      observation: alertObservation(70_000),
      rules: [
        {
          id: "alt",
          type: "ALTERNATE_SAVINGS",
          targetAmountMinor: 0,
          currency: "BRL",
          scope: "TOTAL",
          active: true,
          minSavingsMinor: 1_000,
        },
      ],
      userId: "user-a",
      monitorId: "mon-1",
      context: { netSavingsMinor: null, extraMinutes: null },
    });
    expect(unknownSavings).toEqual([]);

    const quietNow = new Date("2026-10-29T15:00:00.000Z");
    const duringQuiet = draftsForObservation({
      observation: alertObservation(80_000),
      rules: [target],
      userId: "user-a",
      monitorId: "mon-1",
      context: { now: quietNow, quietStartHour: 12, quietEndHour: 18, digestEnabled: true },
    });
    const duringQuietAgain = draftsForObservation({
      observation: alertObservation(80_000),
      rules: [target],
      userId: "user-a",
      monitorId: "mon-1",
      context: { now: quietNow, quietStartHour: 12, quietEndHour: 18, digestEnabled: true },
    });
    expect(duringQuiet.every((draft) => draft.title.startsWith("Resumo diário"))).toBe(true);
    expect(duringQuiet.map((draft) => draft.dedupKey)).toEqual(duringQuietAgain.map((draft) => draft.dedupKey));
    expect(duringQuiet.some((draft) => draft.channel === "EMAIL" && draft.status === "RECORDED")).toBe(true);

    const percent = draftsForObservation({
      observation: alertObservation(70_000),
      rules: [
        {
          id: "drop",
          type: "PERCENT_DROP",
          targetAmountMinor: 0,
          currency: "BRL",
          scope: "TOTAL",
          active: true,
          percentPoints: 10,
        },
      ],
      userId: "user-a",
      monitorId: "mon-1",
      context: { previousAmountMinor: 100_000 },
    });
    expect(percent.some((draft) => draft.title.startsWith("Queda de preço"))).toBe(true);

    const low = draftsForObservation({
      observation: alertObservation(70_000),
      rules: [
        {
          id: "low",
          type: "NEW_LOW",
          targetAmountMinor: 0,
          currency: "BRL",
          scope: "TOTAL",
          active: true,
        },
      ],
      userId: "user-a",
      monitorId: "mon-1",
      context: { lowestAmountMinor: 90_000 },
    });
    expect(low.some((draft) => draft.title.startsWith("Novo menor preço"))).toBe(true);
    const sameLow = draftsForObservation({
      observation: alertObservation(90_000),
      rules: [
        {
          id: "low",
          type: "NEW_LOW",
          targetAmountMinor: 0,
          currency: "BRL",
          scope: "TOTAL",
          active: true,
        },
      ],
      userId: "user-a",
      monitorId: "mon-1",
      context: { lowestAmountMinor: 90_000 },
    });
    expect(sameLow).toEqual([]);
  });
});

describe("link da viagem", () => {
  it("marca o simulador como demonstração e só abre URL real quando a tarifa é da fonte", () => {
    const demo = describeTripLink("/ofertas-simuladas/sim-0-GYN-LIS", "DEMONSTRATION");
    expect(demo.kind).toBe("demonstration");
    expect(demo.label).toBe("Link de demonstração");
    expect(demo.href.startsWith("/ofertas-simuladas/")).toBe(true);
    expect(demo.note.toLowerCase()).toContain("não é o site da companhia");
    expect(demo.note.toLowerCase()).not.toContain("comprar");

    const missing = describeTripLink(null, "DEMONSTRATION");
    expect(missing.kind).toBe("demonstration");
    expect(missing.href).toBe("/ofertas-simuladas/sem-url-real");

    const disguised = describeTripLink("https://www.example-airline.test/viagem", "DEMONSTRATION");
    expect(disguised.kind).toBe("demonstration");
    expect(disguised.external).toBe(false);

    const live = describeTripLink("https://www.example-airline.test/viagem", "LIVE_CURRENT");
    expect(live.kind).toBe("source");
    expect(live.external).toBe(true);
    if (live.kind === "source") expect(live.href).toBe("https://www.example-airline.test/viagem");
    expect(live.label).toBe("Abrir o link da viagem");
    expect(live.note.toLowerCase()).toContain("não vende");

    const withoutUrl = describeTripLink(null, "LIVE_CURRENT");
    expect(withoutUrl.kind).toBe("unavailable");
    expect(withoutUrl.href).toBeNull();
  });
});
