import { formatDuration } from "./labels";
import { formatMoney } from "./money";

export const UNKNOWN_COST_LABEL = "não informado";

export type AirportCost = {
  airport: string;
  transferMinor: number | null;
  lodgingMinor: number | null;
  feesMinor: number | null;
  transferMinutes: number | null;
};

export type CostParts = {
  fareMinor: number | null;
  baggageMinor: number | null;
  transferMinor: number | null;
  lodgingMinor: number | null;
  feesMinor: number | null;
};

export type RouteQuote = CostParts & {
  flightMinutes: number | null;
  groundMinutes: number | null;
};

export function formatCost(amountMinor: number | null, currency: string): string {
  if (amountMinor === null) return UNKNOWN_COST_LABEL;
  return formatMoney(amountMinor, currency);
}

export function totalCost(parts: CostParts): number | null {
  const values = [parts.fareMinor, parts.baggageMinor, parts.transferMinor, parts.lodgingMinor, parts.feesMinor];
  if (values.some((value) => value === null)) return null;
  return (values as number[]).reduce((sum, value) => sum + value, 0);
}

export function baggageCostMinor(input: {
  requiredBags: number | null;
  baggageKnown: boolean;
  baggageIncluded: boolean | null;
  includedBags: number | null;
  extraBagAmountMinor: number | null;
}): number | null {
  if (input.requiredBags === null) return null;
  if (input.requiredBags <= 0) return 0;
  if (!input.baggageKnown || input.baggageIncluded === null) return null;
  const included = input.baggageIncluded ? Math.max(0, input.includedBags ?? 0) : 0;
  const missing = Math.max(0, input.requiredBags - included);
  if (missing === 0) return 0;
  if (input.extraBagAmountMinor === null) return null;
  return input.extraBagAmountMinor * missing;
}

function sumPair(left: number | null, right: number | null): number | null {
  if (left === null || right === null) return null;
  return left + right;
}

function costFor(costs: AirportCost[], airport: string): AirportCost | null {
  return costs.find((cost) => cost.airport === airport) ?? null;
}

export function quoteRoute(input: {
  fareMinor: number;
  origin: string;
  destination: string;
  durationMinutes: number | null;
  requiredBags: number | null;
  baggageKnown: boolean;
  baggageIncluded: boolean | null;
  includedBags: number | null;
  extraBagAmountMinor: number | null;
  costs: AirportCost[];
}): RouteQuote {
  const origin = costFor(input.costs, input.origin);
  const destination = costFor(input.costs, input.destination);
  const baggageMinor = baggageCostMinor({
    requiredBags: input.requiredBags,
    baggageKnown: input.baggageKnown,
    baggageIncluded: input.baggageIncluded,
    includedBags: input.includedBags,
    extraBagAmountMinor: input.extraBagAmountMinor,
  });
  const transferMinor = sumPair(origin?.transferMinor ?? null, destination?.transferMinor ?? null);
  const lodgingMinor = sumPair(origin?.lodgingMinor ?? null, destination?.lodgingMinor ?? null);
  const feesMinor = sumPair(origin?.feesMinor ?? null, destination?.feesMinor ?? null);
  const groundMinutes = sumPair(origin?.transferMinutes ?? null, destination?.transferMinutes ?? null);
  const parts = { fareMinor: input.fareMinor, baggageMinor, transferMinor, lodgingMinor, feesMinor };
  return { ...parts, flightMinutes: input.durationMinutes, groundMinutes };
}

export type AlternateComparison = {
  savingsMinor: number | null;
  extraTravelMinutes: number | null;
  cheaperAfterCosts: boolean;
  summary: string;
};

function travelMinutes(quote: RouteQuote): number | null {
  if (quote.flightMinutes === null || quote.groundMinutes === null) return null;
  return quote.flightMinutes + quote.groundMinutes;
}

export function compareAlternate(primary: RouteQuote, alternate: RouteQuote, currency: string): AlternateComparison {
  const primaryTotal = totalCost(primary);
  const alternateTotal = totalCost(alternate);
  if (primaryTotal === null || alternateTotal === null) {
    return {
      savingsMinor: null,
      extraTravelMinutes: null,
      cheaperAfterCosts: false,
      summary: "Custo total não informado. Um valor desconhecido não entra como zero.",
    };
  }
  const primaryTravel = travelMinutes(primary);
  const alternateTravel = travelMinutes(alternate);
  const extraTravelMinutes =
    primaryTravel === null || alternateTravel === null ? null : alternateTravel - primaryTravel;
  const savingsMinor = primaryTotal - alternateTotal;
  const timeText =
    extraTravelMinutes === null
      ? "Tempo extra não informado."
      : extraTravelMinutes > 0
        ? `Tempo extra de ${formatDuration(extraTravelMinutes)}.`
        : extraTravelMinutes === 0
          ? "Sem tempo extra de deslocamento."
          : `O deslocamento fica ${formatDuration(-extraTravelMinutes)} mais curto.`;
  if (savingsMinor > 0) {
    return {
      savingsMinor,
      extraTravelMinutes,
      cheaperAfterCosts: true,
      summary: `Economia estimada de ${formatMoney(savingsMinor, currency)} depois da tarifa, da bagagem e dos custos extras. ${timeText}`,
    };
  }
  if (alternate.fareMinor !== null && primary.fareMinor !== null && alternate.fareMinor < primary.fareMinor) {
    return {
      savingsMinor,
      extraTravelMinutes,
      cheaperAfterCosts: false,
      summary: "A tarifa isolada é menor. Depois da bagagem e dos custos extras, o total não fica menor.",
    };
  }
  return {
    savingsMinor,
    extraTravelMinutes,
    cheaperAfterCosts: false,
    summary: "Depois da bagagem e dos custos extras, o total não fica menor.",
  };
}
