import type { RunStatus } from "./coverage";
import type { Cabin, PriceKind, ProviderOffer, ProviderQuery, Segment } from "./provider";

export type SearchDefinitionRecord = {
  id: string;
  key: string;
} & ProviderQuery & {
    provider: string;
    providerVersion: string;
  };

export type RunRecord = {
  id: string;
  monitorId: string | null;
  userId: string | null;
  scheduledFor: string | null;
  filtersVersion: number | null;
  requestKey: string | null;
  status: RunStatus;
  combinationsPlanned: number;
  combinationsQueried: number;
  combinationsSkipped: number;
  partial: boolean;
  datesPassed: boolean;
  hadProviderFailure: boolean;
  stoppedByBudget: boolean;
  nextCursor: number;
  offerCount: number;
  startedAt: Date;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  attempt: number;
};

export type RunSlot = {
  monitorId: string | null;
  scheduledFor: string | null;
  filtersVersion: number | null;
  requestKey: string | null;
};

export type ProviderRequestDraft = {
  searchRunId: string;
  searchDefinitionId: string | null;
  userId: string | null;
  monitorId: string | null;
  provider: string;
  definitionKey: string | null;
  attempt: number;
  latencyMs: number;
  cacheHit: boolean;
  charged: boolean;
  costMinor: number;
  costCurrency: string;
  status: "ok" | "error";
  errorCode: string | null;
  offersJson: ProviderOffer[] | null;
  createdAt: Date;
};

export type ObservationDraft = {
  dedupKey: string;
  collectedAt: Date;
  sourceCollectedAt: Date;
  provider: string;
  providerVersion: string;
  priceKind: PriceKind;
  searchDefinitionId: string;
  searchRunId: string;
  monitorId: string | null;
  filtersVersion: number | null;
  userId: string | null;
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  itineraryKey: string;
  stops: number;
  durationMinutes: number;
  segments: Segment[];
  adults: number;
  childAges: number[];
  cabin: Cabin;
  baggageKnown: boolean;
  baggageIncluded: boolean | null;
  checkedBags: number | null;
  totalAmountMinor: number;
  currency: string;
  market: string;
  offerExpiresAt: Date | null;
  providerOfferId: string | null;
  providerLink: string | null;
  fromCache: boolean;
};

export type ObservationRecord = ObservationDraft & { id: string };

export type NotificationDraft = {
  dedupKey: string;
  userId: string;
  monitorId: string;
  alertRuleId: string | null;
  observationId: string | null;
  channel: "IN_APP" | "EMAIL";
  status: "DELIVERED" | "RECORDED";
  title: string;
  body: string;
};

export type NotificationRecord = NotificationDraft & {
  id: string;
  createdAt: Date;
  readAt: Date | null;
};

export type RouteStatDraft = {
  statDate: string;
  origin: string;
  destination: string;
  cabin: Cabin;
  currency: string;
  baggageSignature: string;
  passengerSignature: string;
  priceKind: PriceKind;
  amountMinor: number;
  departDate: string;
};

export type RoundStore = {
  findRunBySlot(slot: RunSlot): Promise<RunRecord | null>;
  createRun(run: Omit<RunRecord, "id">): Promise<RunRecord>;
  updateRun(id: string, patch: Partial<RunRecord>): Promise<void>;
  upsertSearchDefinition(
    definition: Omit<SearchDefinitionRecord, "id">,
  ): Promise<SearchDefinitionRecord>;
  linkMonitorSearch(monitorId: string, searchDefinitionId: string, filtersVersion: number): Promise<void>;
  recordProviderRequest(request: ProviderRequestDraft): Promise<void>;
  findCache(
    definitionKey: string,
    provider: string,
    now: Date,
    ttlMs: number,
  ): Promise<{ collectedAt: Date; offers: ProviderOffer[] } | null>;
  insertObservation(observation: ObservationDraft): Promise<{ inserted: boolean; observation: ObservationRecord }>;
  insertNotification(notification: NotificationDraft): Promise<{ inserted: boolean }>;
  upsertRouteDailyStat(stat: RouteStatDraft): Promise<void>;
};
