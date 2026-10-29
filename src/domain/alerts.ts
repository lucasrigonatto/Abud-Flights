import { formatBaggage, type StoredBaggage } from "./baggage";
import { formatCivilDate, formatConsultation } from "./dates";
import { sha256 } from "./hash";
import { formatMoney } from "./money";
import type { BudgetScope, PriceKind } from "./provider";

export type AlertRuleInput = {
  id: string;
  type: "TARGET_PRICE";
  targetAmountMinor: number;
  currency: string;
  scope: BudgetScope;
  active: boolean;
};

export type AlertObservation = StoredBaggage & {
  id: string;
  itineraryKey: string;
  totalAmountMinor: number;
  currency: string;
  adults: number;
  priceKind: PriceKind;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  sourceCollectedAt: Date;
  filtersVersion: number;
};

export type AlertDraft = {
  dedupKey: string;
  userId: string;
  monitorId: string;
  alertRuleId: string;
  observationId: string;
  channel: "IN_APP" | "EMAIL";
  status: "DELIVERED" | "RECORDED";
  title: string;
  body: string;
};

export function meetsTarget(
  observation: { totalAmountMinor: number; currency: string; adults: number },
  rule: { targetAmountMinor: number; currency: string; scope: BudgetScope; active?: boolean },
): boolean {
  if (rule.active === false) return false;
  if (observation.currency !== rule.currency) return false;
  if (rule.scope === "TOTAL") return observation.totalAmountMinor <= rule.targetAmountMinor;
  if (observation.adults <= 0) return false;
  return observation.totalAmountMinor <= rule.targetAmountMinor * observation.adults;
}

export function alertDedupKey(parts: {
  monitorId: string;
  ruleId: string;
  filtersVersion: number;
  itineraryKey: string;
  totalAmountMinor: number;
  currency: string;
  baggage: StoredBaggage;
  adults: number;
  channel: "IN_APP" | "EMAIL";
}): string {
  return sha256(
    JSON.stringify({
      monitorId: parts.monitorId,
      ruleId: parts.ruleId,
      filtersVersion: parts.filtersVersion,
      itineraryKey: parts.itineraryKey,
      totalAmountMinor: parts.totalAmountMinor,
      currency: parts.currency,
      baggageKnown: parts.baggage.baggageKnown,
      baggageIncluded: parts.baggage.baggageIncluded,
      checkedBags: parts.baggage.checkedBags,
      adults: parts.adults,
      channel: parts.channel,
    }),
  );
}

function partyLabel(adults: number): string {
  return adults === 1 ? "1 passageiro" : `${adults} passageiros`;
}

export function draftsForObservation(input: {
  observation: AlertObservation;
  rules: AlertRuleInput[];
  userId: string;
  monitorId: string;
}): AlertDraft[] {
  const drafts: AlertDraft[] = [];
  for (const rule of input.rules) {
    if (rule.type !== "TARGET_PRICE") continue;
    if (!meetsTarget(input.observation, rule)) continue;
    const kind =
      input.observation.priceKind === "DEMONSTRATION"
        ? "Preço de demonstração"
        : input.observation.priceKind === "LIVE_INDICATIVE"
          ? "Preço indicativo"
          : "Tarifa ao vivo";
    const scope = rule.scope === "PER_PERSON" ? "O preço-alvo é por pessoa." : "O preço-alvo é para todos os passageiros.";
    const body = [
      `${kind}: ${formatMoney(input.observation.totalAmountMinor, input.observation.currency)} para ${partyLabel(input.observation.adults)}.`,
      `${input.observation.origin} → ${input.observation.destination}, ida ${formatCivilDate(input.observation.departDate)}, volta ${formatCivilDate(input.observation.returnDate)}.`,
      `Bagagem: ${formatBaggage(input.observation)}.`,
      formatConsultation(input.observation.sourceCollectedAt) + ".",
      scope,
      input.observation.priceKind === "DEMONSTRATION" ? "Não é uma tarifa ao vivo." : "A oferta pode expirar antes da próxima consulta.",
    ].join(" ");
    const title = `Preço-alvo atingido em ${input.observation.origin} → ${input.observation.destination}`;
    for (const channel of ["IN_APP", "EMAIL"] as const) {
      drafts.push({
        dedupKey: alertDedupKey({
          monitorId: input.monitorId,
          ruleId: rule.id,
          filtersVersion: input.observation.filtersVersion,
          itineraryKey: input.observation.itineraryKey,
          totalAmountMinor: input.observation.totalAmountMinor,
          currency: input.observation.currency,
          baggage: input.observation,
          adults: input.observation.adults,
          channel,
        }),
        userId: input.userId,
        monitorId: input.monitorId,
        alertRuleId: rule.id,
        observationId: input.observation.id,
        channel,
        status: channel === "EMAIL" ? "RECORDED" : "DELIVERED",
        title,
        body,
      });
    }
  }
  return drafts;
}
