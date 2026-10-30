export type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

export type PriceKind = "DEMONSTRATION" | "LIVE_CURRENT" | "LIVE_INDICATIVE";

export type BudgetScope = "TOTAL" | "PER_PERSON";

export type DateMode = "FIXED" | "FLEX";

export type Segment = {
  origin: string;
  destination: string;
  airline: string;
  airlineName: string;
  flightNumber: string;
  departLocal: string;
  arriveLocal: string;
};

export type BaggageInfo = {
  known: boolean;
  included: boolean | null;
  checkedBags: number | null;
};

export type ProviderQuery = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string;
  adults: number;
  childAges: number[];
  cabin: Cabin;
  checkedBags: number | null;
  currency: string;
  market: string;
  maxStops: number;
  maxDurationMinutes: number;
};

export type ProviderOffer = {
  providerOfferId: string;
  priceKind: PriceKind;
  totalAmountMinor: number;
  currency: string;
  market: string;
  adults: number;
  childAges: number[];
  cabin: Cabin;
  baggage: BaggageInfo;
  expiresAt: string | null;
  link: string | null;
  stops: number;
  durationMinutes: number;
  segments: Segment[];
};

export type ProviderSearchResult = {
  offers: ProviderOffer[];
};

export class ProviderError extends Error {
  readonly temporary: boolean;
  readonly code: string;
  readonly charged: boolean;

  constructor(message: string, options: { temporary: boolean; code: string; charged?: boolean }) {
    super(message);
    this.name = "ProviderError";
    this.temporary = options.temporary;
    this.code = options.code;
    this.charged = options.charged ?? false;
  }
}

export type FlightProvider = {
  readonly id: string;
  readonly version: string;
  readonly allowsCache: boolean;
  readonly retainsHistory: boolean;
  readonly cacheTtlMs: number;
  search(query: ProviderQuery): Promise<ProviderSearchResult>;
};

export type MonitorCriteria = {
  origins: string[];
  destinations: string[];
  dateMode: DateMode;
  departDate: string;
  returnDate: string;
  flexDays: number;
  adults: number;
  childAges: number[];
  cabin: Cabin;
  checkedBags: number | null;
  currency: string;
  market: string;
  maxStops: number;
  maxDurationMinutes: number;
};
