import { describe, expect, it } from "vitest";
import { buildCombinations } from "../src/domain/combinations";
import { AIRPORTS } from "../src/lib/airports";
import { parseTripForm } from "../src/lib/parse-trip";
import { createSimulator } from "../src/providers/simulator";

const codes = new Set(AIRPORTS.map((airport) => airport.iata));
const today = "2026-11-03";

function form(entries: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) value.forEach((item) => data.append(key, item));
    else data.set(key, value);
  }
  return data;
}

const roundTrip = {
  tripType: "ROUND_TRIP",
  origin: "NRT",
  destination: "SYD",
  departDate: "2027-04-10",
  returnDate: "2027-04-20",
  flexDays: "0",
  adults: "1",
  hasChildren: "0",
  cabin: "ECONOMY",
  bags: "unset",
  currency: "BRL",
  market: "BR",
  maxStops: "",
};

describe("formulário de busca", () => {
  it("aceita qualquer aeroporto comercial e não exige GYN nem LIS", () => {
    expect(AIRPORTS.length).toBeGreaterThan(3000);
    expect(codes.has("NRT")).toBe(true);
    expect(codes.has("SYD")).toBe(true);
    const parsed = parseTripForm(form(roundTrip), codes, "search", today);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.criteria.origins).toEqual(["NRT"]);
    expect(parsed.value.criteria.destinations).toEqual(["SYD"]);
    expect(parsed.value.criteria.maxStops).toBeNull();
    expect(parsed.value.criteria.childAges).toEqual([]);
    expect(parsed.value.criteria.hasChildren).toBe(false);
  });

  it("somente ida não pede volta, segunda origem nem segundo destino", () => {
    const parsed = parseTripForm(form({ ...roundTrip, tripType: "ONE_WAY" }), codes, "search", today);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.criteria.tripType).toBe("ONE_WAY");
    expect(parsed.value.criteria.returnDate).toBeNull();
    expect(parsed.value.criteria.origins).toEqual(["NRT"]);
    expect(parsed.value.criteria.destinations).toEqual(["SYD"]);
    const combinations = buildCombinations(parsed.value.criteria, today);
    expect(combinations.length).toBe(1);
    expect(combinations[0]?.returnDate).toBeNull();
  });

  it("ida e volta sem data de volta falha", () => {
    const data = form(roundTrip);
    data.delete("returnDate");
    const parsed = parseTripForm(data, codes, "search", today);
    expect(parsed.ok).toBe(false);
  });

  it("aceita ±5 dias e rejeita uma folga fora da lista", () => {
    const allowed = parseTripForm(form({ ...roundTrip, flexDays: "5" }), codes, "search", today);
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.value.criteria.flexDays).toBe(5);
    const rejected = parseTripForm(form({ ...roundTrip, flexDays: "7" }), codes, "search", today);
    expect(rejected.ok).toBe(false);
  });

  it("permite cinco alternativas de cada lado e recusa a sexta", () => {
    const five = parseTripForm(
      form({
        ...roundTrip,
        originAlt: ["HND", "KIX", "NGO", "FUK", "CTS"],
        destinationAlt: ["MEL", "BNE", "PER", "ADL", "CNS"],
      }),
      codes,
      "search",
      today,
    );
    expect(five.ok).toBe(true);
    if (five.ok) {
      expect(five.value.criteria.origins).toHaveLength(6);
      expect(five.value.criteria.destinations).toHaveLength(6);
    }
    const six = parseTripForm(
      form({ ...roundTrip, originAlt: ["HND", "KIX", "NGO", "FUK", "CTS", "OKA"] }),
      codes,
      "search",
      today,
    );
    expect(six.ok).toBe(false);
  });

  it("registra só se há crianças, sem idade", () => {
    const parsed = parseTripForm(form({ ...roundTrip, hasChildren: "1", childAges: "4, 9" }), codes, "search", today);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.criteria.hasChildren).toBe(true);
    expect(parsed.value.criteria.childAges).toEqual([]);
  });

  it("aceita até 1 ou até 2 conexões e não usa duração máxima", () => {
    const one = parseTripForm(form({ ...roundTrip, maxStops: "1", maxDurationHours: "8" }), codes, "search", today);
    const two = parseTripForm(form({ ...roundTrip, maxStops: "2" }), codes, "search", today);
    const none = parseTripForm(form({ ...roundTrip, maxStops: "0" }), codes, "search", today);
    expect(one.ok && one.value.criteria.maxStops).toBe(1);
    expect(one.ok && one.value.criteria.maxDurationMinutes).toBe(72 * 60);
    expect(two.ok && two.value.criteria.maxStops).toBe(2);
    expect(none.ok).toBe(false);
  });

  it("a somente ida do simulador não inventa o trecho de volta", async () => {
    const result = await createSimulator({ now: () => new Date("2026-11-03T12:00:00Z") }).search({
      origin: "NRT",
      destination: "SYD",
      departDate: "2027-04-10",
      returnDate: null,
      adults: 1,
      childAges: [],
      cabin: "ECONOMY",
      checkedBags: null,
      currency: "BRL",
      market: "BR",
      maxStops: null,
      maxDurationMinutes: 72 * 60,
    });
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers.every((offer) => offer.priceKind === "DEMONSTRATION")).toBe(true);
    expect(result.offers.every((offer) => offer.segments.every((segment) => segment.departLocal.startsWith("2027-04-10")))).toBe(true);
    expect(result.offers.some((offer) => offer.stops === 0)).toBe(true);
    expect(result.offers.some((offer) => offer.stops === 1)).toBe(true);
  });
});
