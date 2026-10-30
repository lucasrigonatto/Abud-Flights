import { baggageSignature, type StoredBaggage } from "./baggage";
import type { Cabin, PriceKind } from "./provider";

export const MIN_OBSERVATIONS = 5;
export const MIN_DISTINCT_DAYS = 3;

export type ObservationView = StoredBaggage & {
  filtersVersion: number | null;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  cabin: Cabin;
  adults: number;
  childAges: number[];
  currency: string;
  market: string;
  priceKind: PriceKind;
  totalAmountMinor: number;
  collectedAt: string;
  sourceCollectedAt: string;
};

export type Classification =
  | "historico_insuficiente"
  | "abaixo_da_faixa"
  | "dentro_da_faixa"
  | "acima_da_faixa";

export type HistoryReading = {
  classification: Classification;
  label: string;
  sampleSize: number;
  distinctDays: number;
  distinctDepartures: number;
  minAmountMinor: number | null;
  medianAmountMinor: number | null;
};

const LABELS: Record<Classification, string> = {
  historico_insuficiente: "Histórico insuficiente.",
  abaixo_da_faixa: "Abaixo do histórico.",
  dentro_da_faixa: "Dentro do histórico.",
  acima_da_faixa: "Acima do histórico.",
};

export function comparabilityKey(
  observation: Pick<
    ObservationView,
    | "origin"
    | "destination"
    | "cabin"
    | "adults"
    | "childAges"
    | "currency"
    | "market"
    | "priceKind"
    | "baggageKnown"
    | "baggageIncluded"
    | "checkedBags"
  >,
): string {
  const ages = [...observation.childAges].sort((left, right) => left - right).join(".");
  return [
    observation.origin,
    observation.destination,
    observation.cabin,
    observation.adults,
    ages,
    observation.currency,
    observation.market,
    observation.priceKind,
    baggageSignature(observation),
  ].join("|");
}

export function comparableHistory(
  observations: ObservationView[],
  filtersVersion: number,
  key: string,
): ObservationView[] {
  return observations.filter(
    (observation) => observation.filtersVersion === filtersVersion && comparabilityKey(observation) === key,
  );
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
}

function percentile(sorted: number[], ratio: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index];
}

export function groupComparable(
  observations: ObservationView[],
  filtersVersion: number,
): Array<{ key: string; observations: ObservationView[]; reading: HistoryReading }> {
  const current = observations.filter((observation) => observation.filtersVersion === filtersVersion);
  const keys = [...new Set(current.map((observation) => comparabilityKey(observation)))];
  return keys.map((key) => {
    const group = current.filter((observation) => comparabilityKey(observation) === key);
    return { key, observations: group, reading: classifyHistory(group) };
  });
}

export function classifyHistory(comparable: ObservationView[]): HistoryReading {
  const distinctDays = new Set(comparable.map((observation) => observation.collectedAt.slice(0, 10))).size;
  const distinctDepartures = new Set(comparable.map((observation) => observation.departDate)).size;
  const base = {
    sampleSize: comparable.length,
    distinctDays,
    distinctDepartures,
    minAmountMinor: comparable.length ? Math.min(...comparable.map((observation) => observation.totalAmountMinor)) : null,
    medianAmountMinor: null as number | null,
  };
  if (comparable.length < MIN_OBSERVATIONS || distinctDays < MIN_DISTINCT_DAYS) {
    return { classification: "historico_insuficiente", label: LABELS.historico_insuficiente, ...base };
  }
  const prices = comparable.map((observation) => observation.totalAmountMinor).sort((left, right) => left - right);
  const latest = [...comparable].sort((left, right) => left.collectedAt.localeCompare(right.collectedAt)).at(-1);
  if (!latest) {
    return { classification: "historico_insuficiente", label: LABELS.historico_insuficiente, ...base };
  }
  const low = percentile(prices, 0.25);
  const high = percentile(prices, 0.75);
  let classification: Classification = "dentro_da_faixa";
  if (latest.totalAmountMinor < low) classification = "abaixo_da_faixa";
  else if (latest.totalAmountMinor > high) classification = "acima_da_faixa";
  return {
    classification,
    label: LABELS[classification],
    ...base,
    medianAmountMinor: median(prices),
  };
}

export type PricePoint = { day: string; amountMinor: number };

export function collectionDay(collectedAt: string): string {
  return collectedAt.slice(0, 10);
}

export function lowestByCollectionDay(observations: ObservationView[]): PricePoint[] {
  const best = new Map<string, number>();
  for (const observation of observations) {
    const day = collectionDay(observation.collectedAt);
    const current = best.get(day);
    if (current === undefined || observation.totalAmountMinor < current) best.set(day, observation.totalAmountMinor);
  }
  return [...best.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([day, amountMinor]) => ({ day, amountMinor }));
}

function daysBetween(start: string, end: string): number {
  const left = Date.parse(`${start}T00:00:00.000Z`);
  const right = Date.parse(`${end}T00:00:00.000Z`);
  return Math.round((right - left) / 86_400_000);
}

export function chartSegments(points: PricePoint[]): PricePoint[][] {
  if (points.length === 0) return [];
  const segments: PricePoint[][] = [[points[0]]];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (daysBetween(previous.day, current.day) > 1) segments.push([current]);
    else segments[segments.length - 1].push(current);
  }
  return segments;
}

export function dateMatrix(observations: ObservationView[]): {
  departures: string[];
  returns: string[];
  amounts: Array<Array<number | null>>;
} {
  const departures = [...new Set(observations.map((observation) => observation.departDate))].sort();
  const returns = [...new Set(observations.map((observation) => observation.returnDate))].sort();
  const best = new Map<string, number>();
  for (const observation of observations) {
    const key = `${observation.departDate}|${observation.returnDate}`;
    const current = best.get(key);
    if (current === undefined || observation.totalAmountMinor < current) best.set(key, observation.totalAmountMinor);
  }
  return {
    departures,
    returns,
    amounts: departures.map((departDate) =>
      returns.map((returnDate) => {
        const amount = best.get(`${departDate}|${returnDate}`);
        return amount === undefined ? null : amount;
      }),
    ),
  };
}
