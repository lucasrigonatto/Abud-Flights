import { formatBaggage, type StoredBaggage } from "./baggage";
import { formatCivilDate, formatConsultation, hourInTimeZone, isoDateInTimeZone } from "./dates";
import { sha256 } from "./hash";
import { formatDuration } from "./labels";
import { formatMoney } from "./money";
import type { BudgetScope, PriceKind } from "./provider";

export type AlertKind = "TARGET_PRICE" | "PERCENT_DROP" | "NEW_LOW" | "ALTERNATE_SAVINGS" | "DAILY_DIGEST";

export type AlertRuleInput = {
  id: string;
  type: AlertKind;
  targetAmountMinor: number;
  currency: string;
  scope: BudgetScope;
  active: boolean;
  percentPoints?: number | null;
  minSavingsMinor?: number | null;
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

export type AlertContext = {
  previousAmountMinor?: number | null;
  lowestAmountMinor?: number | null;
  netSavingsMinor?: number | null;
  extraMinutes?: number | null;
  now?: Date;
  quietStartHour?: number | null;
  quietEndHour?: number | null;
  digestEnabled?: boolean;
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

export function toAlertRule(rule: {
  id: string;
  type: AlertKind;
  targetAmountMinor: number;
  currency: string;
  scope: BudgetScope;
  active: boolean;
  percentPoints?: number | null;
  minSavingsMinor?: number | null;
}): AlertRuleInput {
  return {
    id: rule.id,
    type: rule.type,
    targetAmountMinor: rule.targetAmountMinor,
    currency: rule.currency,
    scope: rule.scope,
    active: rule.active,
    percentPoints: rule.percentPoints ?? null,
    minSavingsMinor: rule.minSavingsMinor ?? null,
  };
}

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
  savingsMinor?: number | null;
}): string {
  const payload: Record<string, unknown> = {
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
  };
  if (parts.savingsMinor !== undefined) payload.savingsMinor = parts.savingsMinor;
  return sha256(JSON.stringify(payload));
}

export function digestDedupKey(parts: {
  monitorId: string;
  filtersVersion: number;
  day: string;
  channel: "IN_APP" | "EMAIL";
}): string {
  return sha256(
    JSON.stringify({
      kind: "digest",
      monitorId: parts.monitorId,
      filtersVersion: parts.filtersVersion,
      day: parts.day,
      channel: parts.channel,
    }),
  );
}

export function isQuietHour(now: Date, start: number | null | undefined, end: number | null | undefined): boolean {
  if (start == null || end == null) return false;
  if (start === end) return false;
  const hour = hourInTimeZone(now);
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function partyLabel(adults: number): string {
  return adults === 1 ? "1 passageiro" : `${adults} passageiros`;
}

function kindLabel(priceKind: PriceKind): string {
  if (priceKind === "DEMONSTRATION") return "Preço de demonstração";
  if (priceKind === "LIVE_INDICATIVE") return "Preço indicativo";
  return "Tarifa ao vivo";
}

function offerSentence(observation: AlertObservation): string {
  return [
    `${kindLabel(observation.priceKind)}: ${formatMoney(observation.totalAmountMinor, observation.currency)} para ${partyLabel(observation.adults)}.`,
    `${observation.origin} → ${observation.destination}, ida ${formatCivilDate(observation.departDate)}, volta ${formatCivilDate(observation.returnDate)}.`,
    `Bagagem: ${formatBaggage(observation)}.`,
    `${formatConsultation(observation.sourceCollectedAt)}.`,
    observation.priceKind === "DEMONSTRATION" ? "Não é uma tarifa ao vivo." : "A oferta pode expirar antes da próxima consulta.",
  ].join(" ");
}

function ruleMatches(rule: AlertRuleInput, observation: AlertObservation, context: AlertContext): boolean {
  if (!rule.active) return false;
  if (rule.currency !== observation.currency) return false;
  if (rule.type === "TARGET_PRICE") return meetsTarget(observation, rule);
  if (rule.type === "PERCENT_DROP") {
    const previous = context.previousAmountMinor;
    const points = rule.percentPoints;
    if (previous == null || previous <= 0 || points == null || points <= 0) return false;
    if (observation.totalAmountMinor >= previous) return false;
    const drop = Math.floor(((previous - observation.totalAmountMinor) * 100) / previous);
    return drop >= points;
  }
  if (rule.type === "NEW_LOW") {
    if (context.lowestAmountMinor == null) return false;
    return observation.totalAmountMinor < context.lowestAmountMinor;
  }
  if (rule.type === "ALTERNATE_SAVINGS") {
    if (context.netSavingsMinor == null || rule.minSavingsMinor == null) return false;
    return context.netSavingsMinor >= rule.minSavingsMinor;
  }
  return false;
}

function titleFor(rule: AlertRuleInput, observation: AlertObservation): string {
  const route = `${observation.origin} → ${observation.destination}`;
  if (rule.type === "PERCENT_DROP") return `Queda de preço em ${route}`;
  if (rule.type === "NEW_LOW") return `Novo menor preço em ${route}`;
  if (rule.type === "ALTERNATE_SAVINGS") return `Economia em aeroporto alternativo em ${route}`;
  return `Preço-alvo atingido em ${route}`;
}

function detailFor(rule: AlertRuleInput, observation: AlertObservation, context: AlertContext): string {
  if (rule.type === "TARGET_PRICE") {
    return rule.scope === "PER_PERSON" ? "O preço-alvo é por pessoa." : "O preço-alvo é para todos os passageiros.";
  }
  if (rule.type === "PERCENT_DROP" && context.previousAmountMinor != null) {
    const drop = Math.floor(((context.previousAmountMinor - observation.totalAmountMinor) * 100) / context.previousAmountMinor);
    return `Queda de ${drop}% em relação aos ${formatMoney(context.previousAmountMinor, observation.currency)} da consulta anterior desta rota.`;
  }
  if (rule.type === "NEW_LOW" && context.lowestAmountMinor != null) {
    return `Este valor é menor que o menor preço já visto neste monitoramento (${formatMoney(context.lowestAmountMinor, observation.currency)}).`;
  }
  if (rule.type === "ALTERNATE_SAVINGS" && context.netSavingsMinor != null) {
    const time =
      context.extraMinutes == null
        ? "Tempo extra não informado."
        : context.extraMinutes > 0
          ? `Tempo extra de ${formatDuration(context.extraMinutes)}.`
          : "Sem tempo extra de deslocamento.";
    return `Economia estimada de ${formatMoney(context.netSavingsMinor, observation.currency)} depois da tarifa, da bagagem e dos custos extras. ${time}`;
  }
  return "";
}

function channelsFor(drafts: AlertDraft[], input: {
  observation: AlertObservation;
  userId: string;
  monitorId: string;
  now: Date;
  quiet: boolean;
  digestEnabled: boolean;
  anchorRuleId: string;
}): AlertDraft[] {
  const individuals = input.quiet ? [] : drafts;
  if (!input.digestEnabled) return individuals;
  const day = isoDateInTimeZone(input.now);
  const digestBody = `Resumo do dia ${formatCivilDate(day)}. ${offerSentence(input.observation)}`;
  const digestTitle = `Resumo diário de ${input.observation.origin} → ${input.observation.destination}`;
  const digest: AlertDraft[] = (["IN_APP", "EMAIL"] as const).map((channel) => ({
    dedupKey: digestDedupKey({
      monitorId: input.monitorId,
      filtersVersion: input.observation.filtersVersion,
      day,
      channel,
    }),
    userId: input.userId,
    monitorId: input.monitorId,
    alertRuleId: input.anchorRuleId,
    observationId: input.observation.id,
    channel,
    status: channel === "EMAIL" ? "RECORDED" : "DELIVERED",
    title: digestTitle,
    body: digestBody,
  }));
  return [...individuals, ...digest];
}

export function draftsForObservation(input: {
  observation: AlertObservation;
  rules: AlertRuleInput[];
  userId: string;
  monitorId: string;
  context?: AlertContext;
}): AlertDraft[] {
  const context = input.context ?? {};
  const now = context.now ?? input.observation.sourceCollectedAt;
  const matched = input.rules.filter((rule) => ruleMatches(rule, input.observation, context));
  if (matched.length === 0) return [];
  const drafts: AlertDraft[] = [];
  for (const rule of matched) {
    const body = [offerSentence(input.observation), detailFor(rule, input.observation, context)].filter(Boolean).join(" ");
    const title = titleFor(rule, input.observation);
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
          savingsMinor: rule.type === "ALTERNATE_SAVINGS" ? context.netSavingsMinor : undefined,
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
  return channelsFor(drafts, {
    observation: input.observation,
    userId: input.userId,
    monitorId: input.monitorId,
    now,
    quiet: isQuietHour(now, context.quietStartHour, context.quietEndHour),
    digestEnabled: context.digestEnabled === true,
    anchorRuleId: matched[0].id,
  });
}
