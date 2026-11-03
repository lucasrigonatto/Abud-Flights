import { describe, expect, it } from "vitest";
import { AIRPORTS, CURATED_AIRPORTS } from "../src/lib/airports";
import { flightArc, greatCircle, haversineKm, splitAtAntimeridian } from "../src/lib/geo";
import { buildRouteMapModel, nearbyAirports, segmentChain, toggleAlternate } from "../src/lib/route-map";
import { createSimulator } from "../src/providers/simulator";

const gyn = CURATED_AIRPORTS.find((airport) => airport.iata === "GYN")!;
const bsb = CURATED_AIRPORTS.find((airport) => airport.iata === "BSB")!;
const lis = CURATED_AIRPORTS.find((airport) => airport.iata === "LIS")!;

describe("mapa da rota", () => {
  it("ordena aeroportos próximos de forma estável e deixa Lisboa fora do raio de Goiânia", () => {
    const first = nearbyAirports(CURATED_AIRPORTS, gyn, ["GYN"]);
    const second = nearbyAirports(CURATED_AIRPORTS, gyn, ["GYN"]);
    expect(first.map((item) => item.airport.iata)).toEqual(second.map((item) => item.airport.iata));
    expect(first[0]?.airport.iata).toBe("BSB");
    expect(first.map((item) => item.airport.iata)).not.toContain("LIS");
    expect(first.every((item) => item.distanceKm <= 900)).toBe(true);
    expect(Math.round(haversineKm(gyn, bsb))).toBe(first[0]?.distanceKm);

    const aroundLisbon = nearbyAirports(CURATED_AIRPORTS, lis, ["LIS"]).map((item) => item.airport.iata);
    expect(aroundLisbon).toContain("OPO");
    expect(aroundLisbon).toContain("FAO");
    expect(aroundLisbon).not.toContain("GYN");
  });

  it("marca origem, destino, alternativas e a linha da rota escolhida", () => {
    const model = buildRouteMapModel({
      airports: AIRPORTS,
      origins: ["xxx", "GYN", "BSB"],
      destinations: ["LIS", "OPO"],
    });

    expect(model.markers.find((marker) => marker.iata === "GYN")?.role).toBe("origin");
    expect(model.markers.find((marker) => marker.iata === "BSB")?.role).toBe("alternate-origin");
    expect(model.markers.find((marker) => marker.iata === "LIS")?.role).toBe("destination");
    expect(model.markers.find((marker) => marker.iata === "OPO")?.role).toBe("alternate-destination");
    expect(model.markers.some((marker) => marker.iata === "XXX")).toBe(false);
    expect(model.summary).toBe("GYN → LIS");
    expect(model.markers.find((marker) => marker.iata === "GYN")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "LIS")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "BSB")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "OPO")?.onPath).toBe(true);
    expect(model.markers.some((marker) => marker.role.startsWith("nearby"))).toBe(false);
    expect(model.lines.map((line) => line.kind)).toEqual(["primary", "alternate", "alternate"]);
    expect(model.lines[0]?.positions[0]?.[0]).toBeCloseTo(gyn.latitude, 4);
    expect(model.lines[0]?.positions.at(-1)?.[0]).toBeCloseTo(lis.latitude, 4);
    expect(model.lines[1]?.id).toBe("alt-origin-BSB");
    expect(model.lines[2]?.id).toBe("alt-destination-OPO");
  });

  it("separa a conexão do destino quando a oferta tem escala", () => {
    const segments = [
      { origin: "GYN", destination: "GRU" },
      { origin: "GRU", destination: "LIS" },
      { origin: "LIS", destination: "GYN" },
    ];
    expect(segmentChain(segments)).toEqual(["GYN", "GRU", "LIS", "GYN"]);

    const model = buildRouteMapModel({
      airports: AIRPORTS,
      origins: ["GYN", "BSB"],
      destinations: ["LIS", "OPO"],
      segments,
    });

    expect(model.connections).toEqual(["GRU"]);
    expect(model.summary).toBe("GYN → GRU → LIS → GYN");
    expect(model.lines.map((line) => line.kind)).toEqual(["itinerary"]);
    expect(model.markers.find((marker) => marker.iata === "GRU")?.role).toBe("connection");
    expect(model.markers.find((marker) => marker.iata === "GRU")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "GYN")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "LIS")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "BSB")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "OPO")?.onPath).toBe(true);
    expect(model.markers.find((marker) => marker.iata === "BSB")?.role).toBe("alternate-origin");
    expect(model.markers.find((marker) => marker.iata === "LIS")?.role).toBe("destination");
    const arc = greatCircle(gyn, lis, 8);
    expect(arc[0]).toEqual([gyn.latitude, gyn.longitude]);
    expect(arc.at(-1)?.[0]).toBeCloseTo(lis.latitude, 5);
    expect(arc.at(-1)?.[1]).toBeCloseTo(lis.longitude, 5);

    const route = flightArc(gyn, lis);
    expect(route.length).toBeGreaterThan(24);
    expect(route[0]).toEqual([gyn.latitude, gyn.longitude]);
    expect(route.at(-1)?.[0]).toBeCloseTo(lis.latitude, 5);
    const parts = splitAtAntimeridian([
      [10, 170],
      [12, 179],
      [14, -179],
      [16, -170],
    ]);
    expect(parts).toEqual([
      [
        [10, 170],
        [12, 179],
      ],
      [
        [14, -179],
        [16, -170],
      ],
    ]);
  });

  it("o mapa vazio não inventa aeroporto e a rota parcial mostra só o que foi escolhido", () => {
    const empty = buildRouteMapModel({ airports: AIRPORTS, origins: ["", "xxx"], destinations: [] });
    expect(empty.markers).toEqual([]);
    expect(empty.lines).toEqual([]);
    expect(empty.summary).toBe("");

    const originOnly = buildRouteMapModel({ airports: AIRPORTS, origins: ["GYN"], destinations: [""] });
    expect(originOnly.markers.map((marker) => marker.iata)).toEqual(["GYN"]);
    expect(originOnly.lines).toEqual([]);
    expect(originOnly.markers.some((marker) => marker.iata === "BSB")).toBe(false);
    expect(AIRPORTS.some((airport) => airport.iata === "NRT")).toBe(true);
    expect(AIRPORTS.find((airport) => airport.iata === "GYN")?.latitude).toBe(gyn.latitude);
  });

  it("guarda até cinco alternativas e remove a escolhida", () => {
    expect(toggleAlternate(["", ""], "bsb")).toEqual(["BSB"]);
    expect(toggleAlternate(["BSB"], "CNF")).toEqual(["BSB", "CNF"]);
    expect(toggleAlternate(["BSB", "CNF"], "BSB")).toEqual(["CNF"]);
    expect(toggleAlternate(["BSB", "CNF"], "GRU")).toEqual(["BSB", "CNF", "GRU"]);
    expect(toggleAlternate(["BSB", "CNF"], "12")).toEqual(["BSB", "CNF"]);
    expect(toggleAlternate(["AAA", "BBB", "CCC", "DDD", "EEE"], "FFF")).toEqual(["AAA", "BBB", "CCC", "DDD", "EEE"]);
  });

  it("o simulador desenha uma conexão determinística em GYN → LIS", async () => {
    const result = await createSimulator({ now: () => new Date("2026-10-29T12:00:00Z") }).search({
      origin: "GYN",
      destination: "LIS",
      departDate: "2027-09-07",
      returnDate: "2027-09-17",
      adults: 2,
      childAges: [],
      cabin: "ECONOMY",
      checkedBags: 0,
      currency: "BRL",
      market: "BR",
      maxStops: 1,
      maxDurationMinutes: 20 * 60,
    });
    const connected = result.offers.find((offer) => offer.stops === 1);
    expect(connected?.priceKind).toBe("DEMONSTRATION");
    expect(connected?.segments.map((segment) => `${segment.origin}-${segment.destination}`)).toEqual([
      "GYN-GRU",
      "GRU-LIS",
      "LIS-GRU",
      "GRU-GYN",
    ]);
    const direct = result.offers.filter((offer) => offer.stops === 0);
    expect(direct).toHaveLength(2);
    expect(connected!.totalAmountMinor).toBeGreaterThan(direct[0]!.totalAmountMinor);
  });
});
