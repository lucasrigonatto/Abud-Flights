import { draftsForObservation } from "./alerts";
import { normalizeBaggage, baggageSignature } from "./baggage";
import { buildCombinations, combinationQuery, searchDefinitionKey, selectRoundSlice, travelDatesPassed } from "./combinations";
import { coverageMessage, isTerminalStatus, type RunStatus } from "./coverage";
import { isoDateInTimeZone } from "./dates";
import { sha256 } from "./hash";
import type { AlertRuleInput } from "./alerts";
import type { FlightProvider, MonitorCriteria, ProviderOffer, Segment } from "./provider";
import { ProviderError } from "./provider";
import type { ObservationRecord, RoundStore, RunRecord } from "./store";

export type RoundInput = {
  userId: string | null;
  monitorId: string | null;
  filtersVersion: number | null;
  scheduledFor: string | null;
  requestKey: string | null;
  criteria: MonitorCriteria;
  cursor: number;
  limit: number;
  alertRules: AlertRuleInput[];
  now: Date;
  budgetRemainingMinor: number | null;
  costPerSearchMinor: number;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  today?: string;
};

export type RoundResult = {
  runId: string;
  status: RunStatus;
  deduped: boolean;
  combinationsPlanned: number;
  combinationsQueried: number;
  combinationsSkipped: number;
  partial: boolean;
  datesPassed: boolean;
  hadProviderFailure: boolean;
  stoppedByBudget: boolean;
  nextCursor: number;
  offerCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  attempt: number;
  message: string;
};

function backoffMs(attempt: number): number {
  return [0, 1000, 4000, 12000][attempt] ?? 12000;
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : "Falha inesperada do fornecedor.";
  return new ProviderError(message, { temporary: true, code: "UNEXPECTED", charged: false });
}

function itineraryKey(segments: Segment[]): string {
  return sha256(
    segments
      .map((segment) =>
        [segment.airline, segment.flightNumber, segment.origin, segment.destination, segment.departLocal, segment.arriveLocal].join(
          "~",
        ),
      )
      .join("|"),
  );
}

function resultFromRun(run: RunRecord, deduped: boolean): RoundResult {
  const result: RoundResult = {
    runId: run.id,
    status: run.status,
    deduped,
    combinationsPlanned: run.combinationsPlanned,
    combinationsQueried: run.combinationsQueried,
    combinationsSkipped: run.combinationsSkipped,
    partial: run.partial,
    datesPassed: run.datesPassed,
    hadProviderFailure: run.hadProviderFailure,
    stoppedByBudget: run.stoppedByBudget,
    nextCursor: run.nextCursor,
    offerCount: run.offerCount,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    attempt: run.attempt,
    message: "",
  };
  result.message = coverageMessage(result);
  return result;
}

function observationDedupKey(parts: {
  slot: string;
  provider: string;
  providerVersion: string;
  searchKey: string;
  itinerary: string;
  offer: ProviderOffer;
  baggageKnown: boolean;
  baggageIncluded: boolean | null;
  checkedBags: number | null;
}): string {
  return sha256(
    JSON.stringify({
      slot: parts.slot,
      provider: parts.provider,
      providerVersion: parts.providerVersion,
      searchKey: parts.searchKey,
      itinerary: parts.itinerary,
      priceKind: parts.offer.priceKind,
      totalAmountMinor: parts.offer.totalAmountMinor,
      currency: parts.offer.currency,
      baggageKnown: parts.baggageKnown,
      baggageIncluded: parts.baggageIncluded,
      checkedBags: parts.checkedBags,
      adults: parts.offer.adults,
      childAges: parts.offer.childAges,
      cabin: parts.offer.cabin,
    }),
  );
}

export async function executeRound(store: RoundStore, provider: FlightProvider, input: RoundInput): Promise<RoundResult> {
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const maxAttempts = input.maxAttempts ?? 3;
  const today = input.today ?? isoDateInTimeZone(input.now);
  const combinations = buildCombinations(input.criteria, today);
  const planned = combinations.length;
  const datesPassed = planned === 0 && travelDatesPassed(input.criteria, today);
  const slotKey = input.monitorId && input.scheduledFor
    ? `monitor:${input.monitorId}:${input.scheduledFor}:${input.filtersVersion ?? 0}`
    : `adhoc:${input.requestKey ?? "sem-chave"}`;

  const existing = await store.findRunBySlot({
    monitorId: input.monitorId,
    scheduledFor: input.scheduledFor,
    filtersVersion: input.filtersVersion,
    requestKey: input.requestKey,
  });
  if (existing && isTerminalStatus(existing.status)) return resultFromRun(existing, true);

  let run = existing;
  if (!run) {
    run = await store.createRun({
      monitorId: input.monitorId,
      userId: input.userId,
      scheduledFor: input.scheduledFor,
      filtersVersion: input.filtersVersion,
      requestKey: input.requestKey,
      status: "PENDING",
      combinationsPlanned: planned,
      combinationsQueried: 0,
      combinationsSkipped: planned,
      partial: false,
      datesPassed,
      hadProviderFailure: false,
      stoppedByBudget: false,
      nextCursor: input.cursor,
      offerCount: 0,
      startedAt: input.now,
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
      attempt: 1,
    });
  } else if (run.status === "FAILED") {
    const attempt = run.attempt + 1;
    await store.updateRun(run.id, { status: "PENDING", attempt, errorCode: null, errorMessage: null });
    run = { ...run, status: "PENDING", attempt };
  }

  if (planned === 0) {
    await store.updateRun(run.id, {
      status: "SUCCESS",
      datesPassed,
      finishedAt: input.now,
      combinationsPlanned: 0,
      combinationsQueried: 0,
      combinationsSkipped: 0,
      partial: false,
      offerCount: 0,
    });
    return resultFromRun(
      {
        ...run,
        status: "SUCCESS",
        datesPassed,
        finishedAt: input.now,
        combinationsPlanned: 0,
        combinationsQueried: 0,
        combinationsSkipped: 0,
        partial: false,
        offerCount: 0,
      },
      false,
    );
  }

  const slice = selectRoundSlice(combinations, input.cursor, input.limit);
  let successes = 0;
  let failures = 0;
  let offerCount = 0;
  let stoppedByBudget = false;
  let budget = input.budgetRemainingMinor;
  let processed = 0;
  let lastError: { code: string; message: string } | null = null;
  const seenOffers: ObservationRecord[] = [];

  for (const combination of slice.queried) {
    if (budget !== null && input.costPerSearchMinor > budget) {
      stoppedByBudget = true;
      break;
    }
    const query = combinationQuery(input.criteria, combination);
    const definitionKey = searchDefinitionKey(query, provider.id, provider.version);
    const definition = await store.upsertSearchDefinition({
      key: definitionKey,
      provider: provider.id,
      providerVersion: provider.version,
      ...query,
    });
    if (input.monitorId !== null && input.filtersVersion !== null) {
      await store.linkMonitorSearch(input.monitorId, definition.id, input.filtersVersion);
    }

    const cached = provider.allowsCache
      ? await store.findCache(definitionKey, provider.id, input.now, provider.cacheTtlMs)
      : null;
    let offers: ProviderOffer[] | null = null;
    let sourceCollectedAt = input.now;
    let fromCache = false;

    if (cached) {
      await store.recordProviderRequest({
        searchRunId: run.id,
        searchDefinitionId: definition.id,
        userId: input.userId,
        monitorId: input.monitorId,
        provider: provider.id,
        definitionKey,
        attempt: 1,
        latencyMs: 0,
        cacheHit: true,
        charged: false,
        costMinor: 0,
        costCurrency: "USD",
        status: "ok",
        errorCode: null,
        offersJson: null,
        createdAt: input.now,
      });
      offers = cached.offers;
      sourceCollectedAt = cached.collectedAt;
      fromCache = true;
      successes += 1;
    } else {
      let attempt = 0;
      let error: ProviderError | null = null;
      while (attempt < maxAttempts) {
        attempt += 1;
        const started = Date.now();
        try {
          const result = await provider.search(query);
          await store.recordProviderRequest({
            searchRunId: run.id,
            searchDefinitionId: definition.id,
            userId: input.userId,
            monitorId: input.monitorId,
            provider: provider.id,
            definitionKey,
            attempt,
            latencyMs: Date.now() - started,
            cacheHit: false,
            charged: true,
            costMinor: input.costPerSearchMinor,
            costCurrency: "USD",
            status: "ok",
            errorCode: null,
            offersJson: provider.retainsHistory ? result.offers : null,
            createdAt: input.now,
          });
          if (budget !== null) budget -= input.costPerSearchMinor;
          offers = result.offers;
          error = null;
          break;
        } catch (caught) {
          error = toProviderError(caught);
          await store.recordProviderRequest({
            searchRunId: run.id,
            searchDefinitionId: definition.id,
            userId: input.userId,
            monitorId: input.monitorId,
            provider: provider.id,
            definitionKey,
            attempt,
            latencyMs: Date.now() - started,
            cacheHit: false,
            charged: error.charged,
            costMinor: error.charged ? input.costPerSearchMinor : 0,
            costCurrency: "USD",
            status: "error",
            errorCode: error.code,
            offersJson: null,
            createdAt: input.now,
          });
          if (error.charged && budget !== null) budget -= input.costPerSearchMinor;
          if (!error.temporary || attempt >= maxAttempts) break;
          await sleep(backoffMs(attempt));
        }
      }
      if (error) {
        failures += 1;
        lastError = { code: error.code, message: error.message };
      } else {
        successes += 1;
      }
    }

    processed += 1;
    if (!offers || !provider.retainsHistory) continue;
    for (const offer of offers) {
      if (!Number.isInteger(offer.totalAmountMinor) || offer.totalAmountMinor <= 0) continue;
      if (offer.segments.length === 0) continue;
      const baggage = normalizeBaggage(offer.baggage);
      const flightKey = itineraryKey(offer.segments);
      const saved = await store.insertObservation({
        dedupKey: observationDedupKey({
          slot: slotKey,
          provider: provider.id,
          providerVersion: provider.version,
          searchKey: definitionKey,
          itinerary: flightKey,
          offer,
          ...baggage,
        }),
        collectedAt: input.now,
        sourceCollectedAt,
        provider: provider.id,
        providerVersion: provider.version,
        priceKind: offer.priceKind,
        searchDefinitionId: definition.id,
        searchRunId: run.id,
        monitorId: input.monitorId,
        filtersVersion: input.filtersVersion,
        userId: input.userId,
        origin: query.origin,
        destination: query.destination,
        departDate: query.departDate,
        returnDate: query.returnDate,
        itineraryKey: flightKey,
        stops: offer.stops,
        durationMinutes: offer.durationMinutes,
        segments: offer.segments,
        adults: offer.adults,
        childAges: [...offer.childAges],
        cabin: offer.cabin,
        ...baggage,
        totalAmountMinor: offer.totalAmountMinor,
        currency: offer.currency,
        market: offer.market,
        offerExpiresAt: offer.expiresAt ? new Date(offer.expiresAt) : null,
        providerOfferId: offer.providerOfferId,
        providerLink: offer.link,
        fromCache,
      });
      offerCount += 1;
      if (saved.inserted) {
        await store.upsertRouteDailyStat({
          statDate: isoDateInTimeZone(sourceCollectedAt),
          origin: query.origin,
          destination: query.destination,
          cabin: offer.cabin,
          currency: offer.currency,
          baggageSignature: baggageSignature(baggage),
          passengerSignature: `${offer.adults}:${[...offer.childAges].sort((left, right) => left - right).join(".")}`,
          priceKind: offer.priceKind,
          amountMinor: offer.totalAmountMinor,
          departDate: query.departDate,
        });
      }
      if (input.monitorId && input.userId && input.filtersVersion !== null) {
        seenOffers.push(saved.observation);
      }
    }
  }

  if (input.monitorId && input.userId && input.filtersVersion !== null) {
    await notifyCheapest(store, seenOffers, input);
  }

  const queriedCount = successes + failures;
  const reachedEnd = processed === slice.queried.length && !stoppedByBudget;
  const partial = !reachedEnd || slice.partial || failures > 0 || stoppedByBudget;
  let status: RunStatus;
  if (successes === 0 && failures > 0) status = "FAILED";
  else if (queriedCount === 0 && stoppedByBudget) status = "PARTIAL";
  else if (partial) status = "PARTIAL";
  else if (offerCount === 0) status = "NO_OFFERS";
  else status = "SUCCESS";

  const nextCursor =
    status === "FAILED" ? input.cursor : (slice.start + processed) % Math.max(combinations.length, 1);
  const finished: RunRecord = {
    ...run,
    status,
    combinationsPlanned: planned,
    combinationsQueried: queriedCount,
    combinationsSkipped: Math.max(0, planned - queriedCount),
    partial: status === "PARTIAL",
    datesPassed: false,
    hadProviderFailure: failures > 0,
    stoppedByBudget,
    nextCursor,
    offerCount,
    finishedAt: input.now,
    errorCode: status === "FAILED" ? lastError?.code ?? "PROVIDER_ERROR" : null,
    errorMessage: status === "FAILED" ? lastError?.message ?? "Falha do fornecedor." : null,
  };
  await store.updateRun(run.id, finished);
  return resultFromRun(finished, false);
}

async function notifyCheapest(store: RoundStore, observations: ObservationRecord[], input: RoundInput): Promise<void> {
  const cheapest = new Map<string, ObservationRecord>();
  for (const observation of observations) {
    const current = cheapest.get(observation.currency);
    if (!current || observation.totalAmountMinor < current.totalAmountMinor) cheapest.set(observation.currency, observation);
  }
  for (const observation of cheapest.values()) {
    await notify(store, observation, input);
  }
}

async function notify(store: RoundStore, observation: ObservationRecord, input: RoundInput): Promise<void> {
  if (!input.monitorId || !input.userId || input.filtersVersion === null) return;
  const drafts = draftsForObservation({
    observation: {
      id: observation.id,
      itineraryKey: observation.itineraryKey,
      totalAmountMinor: observation.totalAmountMinor,
      currency: observation.currency,
      adults: observation.adults,
      priceKind: observation.priceKind,
      origin: observation.origin,
      destination: observation.destination,
      departDate: observation.departDate,
      returnDate: observation.returnDate,
      sourceCollectedAt: observation.sourceCollectedAt,
      filtersVersion: input.filtersVersion,
      baggageKnown: observation.baggageKnown,
      baggageIncluded: observation.baggageIncluded,
      checkedBags: observation.checkedBags,
    },
    rules: input.alertRules,
    userId: input.userId,
    monitorId: input.monitorId,
  });
  for (const draft of drafts) {
    await store.insertNotification(draft);
  }
}

export function roundMessage(result: RoundResult): string {
  return coverageMessage(result);
}
