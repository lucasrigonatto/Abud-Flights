import type { PriceKind } from "./provider";
import { selectRoundSlice, type Combination } from "./combinations";

export type PriorSample = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  priceKind: PriceKind;
  totalAmountMinor: number;
  collectedAt: string;
  currency: string;
};

export type FlexibleRound<T> = {
  queried: T[];
  start: number;
  nextCursor: number;
  partial: boolean;
  confirmation: T[];
  exploration: T[];
};

function comboKey(combination: Combination): string {
  return `${combination.origin}|${combination.destination}|${combination.departDate}|${combination.returnDate}`;
}

export function planFlexibleRound<T extends Combination>(
  combinations: T[],
  cursor: number,
  limit: number,
  prior: PriorSample[],
): FlexibleRound<T> {
  if (prior.length === 0) {
    const slice = selectRoundSlice(combinations, cursor, limit);
    return { ...slice, confirmation: slice.queried, exploration: [] };
  }
  if (combinations.length === 0 || limit <= 0) {
    return { queried: [], start: 0, nextCursor: 0, partial: combinations.length > 0, confirmation: [], exploration: [] };
  }

  const stats = new Map<string, { samples: number; best: number | null }>();
  for (const combination of combinations) stats.set(comboKey(combination), { samples: 0, best: null });
  for (const sample of prior) {
    const stat = stats.get(comboKey(sample));
    if (!stat) continue;
    stat.samples += 1;
    if (sample.priceKind === "LIVE_INDICATIVE") continue;
    if (stat.best === null || sample.totalAmountMinor < stat.best) stat.best = sample.totalAmountMinor;
  }

  const priced = combinations
    .filter((combination) => stats.get(comboKey(combination))?.best !== null)
    .sort((left, right) => (stats.get(comboKey(left))?.best ?? 0) - (stats.get(comboKey(right))?.best ?? 0));
  const reserve = combinations.length > limit && limit >= 2 ? 1 : 0;
  const confirmCount = Math.min(priced.length, Math.max(0, Math.min(Math.ceil(limit * 0.75), limit - reserve)));
  const confirmation = priced.slice(0, confirmCount);
  const chosen = new Set(confirmation.map((combination) => comboKey(combination)));
  const rest = combinations.filter((combination) => !chosen.has(comboKey(combination)));
  const ranked = [...rest].sort((left, right) => {
    const leftSamples = stats.get(comboKey(left))?.samples ?? 0;
    const rightSamples = stats.get(comboKey(right))?.samples ?? 0;
    if (leftSamples !== rightSamples) return leftSamples - rightSamples;
    return comboKey(left).localeCompare(comboKey(right));
  });
  const exploreSlots = Math.max(0, Math.min(limit - confirmation.length, ranked.length));
  const start = ranked.length === 0 ? 0 : ((cursor % ranked.length) + ranked.length) % ranked.length;
  const exploration: T[] = [];
  for (let index = 0; index < exploreSlots; index += 1) {
    exploration.push(ranked[(start + index) % ranked.length]);
  }
  const queried = [...confirmation, ...exploration];
  return {
    queried,
    start,
    nextCursor: ranked.length === 0 ? 0 : (start + exploreSlots) % ranked.length,
    partial: combinations.length > queried.length,
    confirmation,
    exploration,
  };
}
