import { shiftDate } from "../domain/dates";
import { fnv1a } from "../domain/hash";
import { LIMITS } from "../domain/limits";
import { ProviderError, type FlightProvider, type ProviderOffer, type ProviderQuery, type Segment } from "../domain/provider";

const AIRLINES = [
  { code: "TP", name: "TAP Air Portugal" },
  { code: "AD", name: "Azul" },
  { code: "LA", name: "LATAM" },
  { code: "G3", name: "GOL" },
  { code: "AF", name: "Air France" },
  { code: "IB", name: "Iberia" },
  { code: "LH", name: "Lufthansa" },
  { code: "BA", name: "British Airways" },
];

export type SimulatorMode = "ok" | "temporary" | "permanent";

function localDateTime(date: string, minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minutesFromMidnight % 60).toString().padStart(2, "0");
  return `${date}T${hours}:${minutes}:00`;
}

function addMinutes(local: string, minutes: number): string {
  const [date, time] = local.split("T");
  const [hours, mins] = time.split(":").map(Number);
  let total = hours * 60 + mins + minutes;
  let day = date;
  while (total >= 24 * 60) {
    total -= 24 * 60;
    day = shiftDate(day, 1);
  }
  return localDateTime(day, total);
}

function perPersonMinor(query: ProviderQuery): number {
  const seed = fnv1a([query.origin, query.destination, query.departDate, query.returnDate, query.cabin, query.currency].join("|"));
  return 180_000 + (seed % 220_000);
}

function partyTotal(perPerson: number, query: ProviderQuery): number {
  let total = perPerson * query.adults;
  for (let index = 0; index < query.childAges.length; index += 1) {
    total += Math.floor((perPerson * 75) / 100);
  }
  return total;
}

function segment(query: ProviderQuery, index: number, departDate: string, duration: number): Segment {
  const seed = fnv1a(`${query.origin}${query.destination}${departDate}${index}`);
  const airline = AIRLINES[seed % AIRLINES.length];
  const depart = localDateTime(departDate, 8 * 60 + (seed % 120));
  return {
    origin: query.origin,
    destination: query.destination,
    airline: airline.code,
    airlineName: airline.name,
    flightNumber: `${airline.code}${100 + (seed % 800)}`,
    departLocal: depart,
    arriveLocal: addMinutes(depart, duration),
  };
}

const HUBS = ["GRU", "MAD", "CDG", "FRA", "GIG"];

function connectionHub(query: ProviderQuery): string | null {
  return HUBS.find((code) => code !== query.origin && code !== query.destination) ?? null;
}

function chainedSegment(origin: string, destination: string, departLocal: string, duration: number, index: number): Segment {
  const seed = fnv1a(`${origin}${destination}${departLocal}${index}`);
  const airline = AIRLINES[seed % AIRLINES.length];
  return {
    origin,
    destination,
    airline: airline.code,
    airlineName: airline.name,
    flightNumber: `${airline.code}${100 + (seed % 800)}`,
    departLocal,
    arriveLocal: addMinutes(departLocal, duration),
  };
}

function connectingOffer(query: ProviderQuery, perPerson: number, now: Date): ProviderOffer | null {
  const hub = connectionHub(query);
  if (!hub) return null;
  const outboundStart = localDateTime(query.departDate, 7 * 60);
  const first = chainedSegment(query.origin, hub, outboundStart, 180, 4);
  const second = chainedSegment(hub, query.destination, addMinutes(first.arriveLocal, 80), 520, 5);
  const returnStart = localDateTime(query.returnDate, 9 * 60);
  const third = chainedSegment(query.destination, hub, returnStart, 500, 6);
  const fourth = chainedSegment(hub, query.origin, addMinutes(third.arriveLocal, 80), 190, 7);
  return {
    providerOfferId: `sim-2-${query.origin}-${query.destination}-${query.departDate}-${query.returnDate}-${query.adults}-${query.currency}`,
    priceKind: "DEMONSTRATION",
    totalAmountMinor: partyTotal(perPerson + 40_000, query),
    currency: query.currency,
    market: query.market,
    adults: query.adults,
    childAges: [...query.childAges],
    cabin: query.cabin,
    baggage: { known: true, included: false, checkedBags: 0 },
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    link: `/ofertas-simuladas/sim-2-${query.origin}-${query.destination}`,
    stops: 1,
    durationMinutes: 780,
    segments: [first, second, third, fourth],
  };
}

function buildOffers(query: ProviderQuery, now: Date): ProviderOffer[] {
  const perPerson = perPersonMinor(query);
  const knownBags = query.checkedBags ?? 0;
  const offers: ProviderOffer[] = [
    {
      providerOfferId: `sim-0-${query.origin}-${query.destination}-${query.departDate}-${query.returnDate}-${query.adults}-${query.currency}`,
      priceKind: "DEMONSTRATION",
      totalAmountMinor: partyTotal(perPerson, query),
      currency: query.currency,
      market: query.market,
      adults: query.adults,
      childAges: [...query.childAges],
      cabin: query.cabin,
      baggage: {
        known: true,
        included: knownBags > 0,
        checkedBags: knownBags,
      },
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      link: `/ofertas-simuladas/sim-0-${query.origin}-${query.destination}`,
      stops: 0,
      durationMinutes: 540,
      segments: [
        segment(query, 0, query.departDate, 540),
        segment({ ...query, origin: query.destination, destination: query.origin }, 1, query.returnDate, 560),
      ],
    },
    {
      providerOfferId: `sim-1-${query.origin}-${query.destination}-${query.departDate}-${query.returnDate}-${query.adults}-${query.currency}`,
      priceKind: "DEMONSTRATION",
      totalAmountMinor: partyTotal(perPerson + 15_000, query),
      currency: query.currency,
      market: query.market,
      adults: query.adults,
      childAges: [...query.childAges],
      cabin: query.cabin,
      baggage: { known: false, included: null, checkedBags: null },
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      link: `/ofertas-simuladas/sim-1-${query.origin}-${query.destination}`,
      stops: 0,
      durationMinutes: 720,
      segments: [
        segment(query, 2, query.departDate, 720),
        segment({ ...query, origin: query.destination, destination: query.origin }, 3, query.returnDate, 700),
      ],
    },
  ];
  const connection = connectingOffer(query, perPerson, now);
  if (connection) offers.push(connection);
  return offers.filter((offer) => offer.stops <= query.maxStops && offer.durationMinutes <= query.maxDurationMinutes);
}

export function createSimulator(options?: { mode?: SimulatorMode; now?: () => Date }): FlightProvider {
  const mode = options?.mode ?? "ok";
  const now = options?.now ?? (() => new Date());
  return {
    id: "simulator",
    version: "1",
    allowsCache: true,
    retainsHistory: true,
    cacheTtlMs: LIMITS.cacheTtlMs,
    async search(query) {
      if (mode === "temporary") {
        throw new ProviderError("O fornecedor simulado não respondeu.", {
          temporary: true,
          code: "SIMULATOR_TIMEOUT",
          charged: false,
        });
      }
      if (mode === "permanent") {
        throw new ProviderError("O fornecedor simulado recusou a consulta.", {
          temporary: false,
          code: "SIMULATOR_REJECTED",
          charged: false,
        });
      }
      return { offers: buildOffers(query, now()) };
    },
  };
}
