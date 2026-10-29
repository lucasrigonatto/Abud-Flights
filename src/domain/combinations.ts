import { flexDates } from "./dates";
import { canonicalJson, sha256 } from "./hash";
import type { MonitorCriteria, ProviderQuery } from "./provider";

export type Combination = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
};

export function buildCombinations(criteria: MonitorCriteria, today: string): Combination[] {
  const flex = criteria.dateMode === "FLEX" ? criteria.flexDays : 0;
  const departures = flexDates(criteria.departDate, flex);
  const returns = flexDates(criteria.returnDate, flex);
  const origins = [...criteria.origins].sort();
  const destinations = [...criteria.destinations].sort();
  const combinations: Combination[] = [];
  for (const origin of origins) {
    for (const destination of destinations) {
      if (origin === destination) continue;
      for (const departDate of departures) {
        if (departDate < today) continue;
        for (const returnDate of returns) {
          if (returnDate <= departDate) continue;
          combinations.push({ origin, destination, departDate, returnDate });
        }
      }
    }
  }
  return combinations;
}

export function travelDatesPassed(criteria: MonitorCriteria, today: string): boolean {
  const flex = criteria.dateMode === "FLEX" ? criteria.flexDays : 0;
  return flexDates(criteria.departDate, flex).every((date) => date < today);
}

export function selectRoundSlice<T>(
  items: T[],
  cursor: number,
  limit: number,
): { queried: T[]; start: number; nextCursor: number; partial: boolean } {
  if (items.length === 0 || limit <= 0) {
    return { queried: [], start: 0, nextCursor: 0, partial: items.length > 0 };
  }
  const count = Math.min(limit, items.length);
  const start = ((cursor % items.length) + items.length) % items.length;
  const queried: T[] = [];
  for (let index = 0; index < count; index += 1) {
    queried.push(items[(start + index) % items.length]);
  }
  return {
    queried,
    start,
    nextCursor: (start + count) % items.length,
    partial: items.length > count,
  };
}

export function combinationQuery(criteria: MonitorCriteria, combination: Combination): ProviderQuery {
  return {
    origin: combination.origin,
    destination: combination.destination,
    departDate: combination.departDate,
    returnDate: combination.returnDate,
    adults: criteria.adults,
    childAges: [...criteria.childAges].sort((left, right) => left - right),
    cabin: criteria.cabin,
    checkedBags: criteria.checkedBags,
    currency: criteria.currency,
    market: criteria.market,
    maxStops: criteria.maxStops,
    maxDurationMinutes: criteria.maxDurationMinutes,
  };
}

export function searchDefinitionKey(query: ProviderQuery, provider: string, providerVersion: string): string {
  return sha256(
    canonicalJson({
      provider,
      providerVersion,
      origin: query.origin,
      destination: query.destination,
      departDate: query.departDate,
      returnDate: query.returnDate,
      adults: query.adults,
      childAges: [...query.childAges].sort((left, right) => left - right),
      cabin: query.cabin,
      checkedBags: query.checkedBags,
      currency: query.currency,
      market: query.market,
      maxStops: query.maxStops,
      maxDurationMinutes: query.maxDurationMinutes,
    }),
  );
}
