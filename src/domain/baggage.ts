import type { BaggageInfo } from "./provider";

export type StoredBaggage = {
  baggageKnown: boolean;
  baggageIncluded: boolean | null;
  checkedBags: number | null;
};

export function normalizeBaggage(baggage: BaggageInfo): StoredBaggage {
  if (!baggage.known || baggage.included === null) {
    return { baggageKnown: false, baggageIncluded: null, checkedBags: null };
  }
  return {
    baggageKnown: true,
    baggageIncluded: baggage.included,
    checkedBags: baggage.checkedBags,
  };
}

export function formatBaggage(baggage: StoredBaggage): string {
  if (!baggage.baggageKnown || baggage.baggageIncluded === null) return "não informado";
  if (!baggage.baggageIncluded) return "não incluída";
  const bags = baggage.checkedBags ?? 0;
  if (bags <= 0) return "incluída";
  return bags === 1 ? "incluída (1 despachada)" : `incluída (${bags} despachadas)`;
}

export function baggageSignature(baggage: StoredBaggage): string {
  if (!baggage.baggageKnown || baggage.baggageIncluded === null) return "unknown";
  return `${baggage.baggageIncluded ? "included" : "excluded"}:${baggage.checkedBags ?? 0}`;
}
