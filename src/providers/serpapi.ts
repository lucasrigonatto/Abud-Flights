import { createHash } from "node:crypto";
import { googleFlightsUrl } from "../domain/flight-search-link";
import { scaleOf } from "../domain/money";
import {
  ProviderError,
  type FlightProvider,
  type ProviderOffer,
  type ProviderQuery,
  type Segment,
} from "../domain/provider";

type JsonObject = Record<string, unknown>;
export type SerpApiOptions = {
  apiKey: string | undefined;
  monthlyLimit?: number;
  fetchImpl?: typeof fetch;
};
export type FreeAccount = {
  monthlyUsed: number;
  planRemaining: number;
  projectLimit: number;
  projectRemaining: number;
  hourlyUsed: number;
  hourlyLimit: number;
};
type Leg = {
  segments: Segment[];
  duration: number;
  priceMinor: number;
  departureToken: string | null;
};

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}
function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function fail(message: string, code: string, temporary = false): never {
  throw new ProviderError(message, { code, temporary, charged: false });
}
function keyOf(options: SerpApiOptions): string {
  const key = options.apiKey?.trim();
  if (!key || key === "replace-with-your-private-key") {
    fail(
      "Configure SERPAPI_API_KEY no servidor para consultar preços reais.",
      "SERPAPI_MISSING_KEY",
    );
  }
  return key;
}

async function request(
  path: string,
  params: URLSearchParams,
  options: SerpApiOptions,
): Promise<JsonObject> {
  const url = new URL(path, "https://serpapi.com");
  params.set("api_key", keyOf(options));
  url.search = params.toString();
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url.toString(), {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    fail(
      "Não foi possível consultar a SerpApi. Tente novamente mais tarde.",
      "SERPAPI_UNAVAILABLE",
      true,
    );
  }
  if (response.status === 401 || response.status === 403) {
    fail("A SerpApi recusou a chave ou o acesso à conta.", "SERPAPI_AUTH");
  }
  if (response.status === 429) {
    fail(
      "A cota da SerpApi foi atingida. As consultas estão pausadas.",
      "SERPAPI_QUOTA",
    );
  }
  if (!response.ok)
    fail(
      "A SerpApi não concluiu a consulta.",
      "SERPAPI_HTTP",
      response.status >= 500,
    );
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    fail("A SerpApi retornou uma resposta inválida.", "SERPAPI_RESPONSE");
  }
  const data = object(body);
  // Never expose provider error bodies: they can contain account details or request credentials.
  if (!data || data.error)
    fail(
      "A SerpApi não retornou uma resposta de busca válida.",
      "SERPAPI_RESPONSE",
    );
  return data;
}

export async function checkSerpApiAccount(
  options: SerpApiOptions,
): Promise<FreeAccount> {
  const projectLimit = options.monthlyLimit ?? 200;
  if (
    !Number.isInteger(projectLimit) ||
    projectLimit < 1 ||
    projectLimit > 250
  ) {
    fail(
      "O limite mensal precisa ficar entre 1 e 250 consultas.",
      "SERPAPI_CONFIGURATION",
    );
  }
  const data = await request("/account.json", new URLSearchParams(), options);
  if (
    data.plan_monthly_price !== 0 ||
    data.extra_credits !== 0 ||
    !integer(data.searches_per_month) ||
    data.searches_per_month < 1 ||
    data.searches_per_month > 250
  ) {
    fail(
      "Esta integração aceita somente o plano Free da SerpApi. Nenhuma busca foi realizada.",
      "SERPAPI_FREE_ONLY",
    );
  }
  if (
    typeof data.account_status !== "string" ||
    data.account_status.toLowerCase() !== "active"
  ) {
    fail(
      "A conta gratuita da SerpApi ainda não está ativa.",
      "SERPAPI_ACCOUNT_INACTIVE",
    );
  }
  if (
    !integer(data.this_month_usage) ||
    !integer(data.plan_searches_left) ||
    !integer(data.last_hour_searches) ||
    !integer(data.account_rate_limit_per_hour) ||
    data.account_rate_limit_per_hour < 1
  ) {
    fail(
      "Não foi possível confirmar a cota gratuita da SerpApi.",
      "SERPAPI_ACCOUNT_RESPONSE",
    );
  }
  const monthlyUsed = data.this_month_usage;
  return {
    monthlyUsed,
    planRemaining: data.plan_searches_left,
    projectLimit,
    projectRemaining: Math.max(
      0,
      Math.min(projectLimit - monthlyUsed, data.plan_searches_left),
    ),
    hourlyUsed: Math.max(
      data.last_hour_searches,
      integer(data.this_hour_searches) ? data.this_hour_searches : 0,
    ),
    hourlyLimit: data.account_rate_limit_per_hour,
  };
}

async function searchRequest(
  params: URLSearchParams,
  options: SerpApiOptions,
  reserve = 1,
) {
  const account = await checkSerpApiAccount(options);
  if (
    account.projectRemaining < reserve ||
    account.hourlyLimit - account.hourlyUsed < reserve
  ) {
    fail(
      "A cota gratuita está no limite. As buscas foram pausadas para preservar o plano Free.",
      "SERPAPI_QUOTA",
    );
  }
  return request("/search.json", params, options);
}

function searchParams(query: ProviderQuery): URLSearchParams {
  if (query.adults !== 1 || query.childAges.length > 0 || query.hasChildren) {
    fail(
      "A integração real inicial aceita 1 adulto, sem crianças. A busca não foi enviada.",
      "SERPAPI_PASSENGERS_UNSUPPORTED",
    );
  }
  if (
    !/^[A-Z]{3}$/.test(query.origin) ||
    !/^[A-Z]{3}$/.test(query.destination) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(query.departDate) ||
    (query.returnDate !== null &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(query.returnDate) ||
        query.returnDate <= query.departDate)) ||
    scaleOf(query.currency) === null ||
    !/^[A-Z]{2}$/.test(query.market)
  ) {
    fail(
      "Confira os aeroportos, as datas, a moeda e o mercado da busca.",
      "SERPAPI_QUERY",
    );
  }
  const cabin = {
    ECONOMY: "1",
    PREMIUM_ECONOMY: "2",
    BUSINESS: "3",
    FIRST: "4",
  }[query.cabin];
  const stops =
    query.maxStops === null || query.maxStops > 2
      ? "0"
      : String(query.maxStops + 1);
  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: query.origin,
    arrival_id: query.destination,
    outbound_date: query.departDate,
    type: query.returnDate ? "1" : "2",
    adults: "1",
    currency: query.currency,
    gl: query.market.toLowerCase(),
    hl: "en",
    travel_class: cabin,
    stops,
    max_duration: String(query.maxDurationMinutes),
    sort_by: "2",
    deep_search: "true",
    no_cache: "true",
  });
  if (query.returnDate) params.set("return_date", query.returnDate);
  // The provider's `bags` parameter means carry-on bags, not checked baggage.
  return params;
}

function parseSegment(value: unknown): Segment | null {
  const data = object(value);
  if (!data) return null;
  const from = object(data.departure_airport),
    to = object(data.arrival_airport);
  if (
    !from ||
    !to ||
    typeof from.id !== "string" ||
    !/^[A-Z]{3}$/.test(from.id) ||
    typeof to.id !== "string" ||
    !/^[A-Z]{3}$/.test(to.id) ||
    typeof from.time !== "string" ||
    typeof to.time !== "string" ||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(from.time) ||
    !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(to.time) ||
    typeof data.airline !== "string" ||
    typeof data.flight_number !== "string"
  )
    return null;
  const flightNumber = data.flight_number.replace(/\s+/g, "").toUpperCase();
  const code = flightNumber.match(/^([A-Z0-9]{2})\d{1,4}$/);
  if (!code) return null;
  return {
    origin: from.id,
    destination: to.id,
    airline: code[1],
    airlineName: data.airline,
    flightNumber,
    departLocal: from.time.replace(" ", "T") + ":00",
    arriveLocal: to.time.replace(" ", "T") + ":00",
  };
}

function parseLeg(
  value: unknown,
  query: ProviderQuery,
  inbound: boolean,
): Leg | null {
  const data = object(value);
  if (
    !data ||
    !Array.isArray(data.flights) ||
    data.flights.length === 0 ||
    !integer(data.total_duration) ||
    data.total_duration === 0 ||
    typeof data.price !== "number" ||
    !Number.isFinite(data.price) ||
    data.price <= 0
  )
    return null;
  const segments = data.flights.map(parseSegment);
  if (segments.some((segment) => segment === null)) return null;
  const ready = segments as Segment[];
  const origin = inbound ? query.destination : query.origin;
  const destination = inbound ? query.origin : query.destination;
  if (
    ready[0].origin !== origin ||
    ready.at(-1)?.destination !== destination ||
    ready[0].departLocal.slice(0, 10) !==
      (inbound ? query.returnDate : query.departDate) ||
    ready.some(
      (segment, index) =>
        index > 0 && ready[index - 1].destination !== segment.origin,
    )
  )
    return null;
  const priceMinor = Math.round(
    data.price * 10 ** (scaleOf(query.currency) ?? 2),
  );
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0) return null;
  return {
    segments: ready,
    duration: data.total_duration,
    priceMinor,
    departureToken:
      typeof data.departure_token === "string" && data.departure_token
        ? data.departure_token
        : null,
  };
}

function legsFrom(
  body: JsonObject,
  query: ProviderQuery,
  inbound: boolean,
): Leg[] {
  const parameters = object(body.search_parameters);
  if (
    parameters?.currency !== query.currency ||
    (!Array.isArray(body.best_flights) && !Array.isArray(body.other_flights))
  ) {
    fail(
      "A resposta não confirmou a moeda ou os resultados da busca.",
      "SERPAPI_RESPONSE",
    );
  }
  const rows = [
    ...(Array.isArray(body.best_flights) ? body.best_flights : []),
    ...(Array.isArray(body.other_flights) ? body.other_flights : []),
  ];
  const valid = rows
    .map((row) => parseLeg(row, query, inbound))
    .filter((leg): leg is Leg => leg !== null);
  if (rows.length > 0 && valid.length === 0)
    fail(
      "Não foi possível validar os itinerários retornados.",
      "SERPAPI_ITINERARY",
    );
  return valid
    .filter(
      (leg) =>
        leg.duration <= query.maxDurationMinutes &&
        (query.maxStops === null || leg.segments.length - 1 <= query.maxStops),
    )
    .sort((a, b) => a.priceMinor - b.priceMinor);
}

function offer(
  query: ProviderQuery,
  outbound: Leg,
  inbound?: Leg,
): ProviderOffer {
  const segments = [...outbound.segments, ...(inbound?.segments ?? [])];
  const id = createHash("sha256")
    .update(JSON.stringify({ query, segments }))
    .digest("hex");
  return {
    providerOfferId: "serpapi-" + id,
    priceKind: "LIVE_CURRENT",
    // A selected return result is the whole round-trip price. Never add both quoted prices.
    totalAmountMinor: inbound?.priceMinor ?? outbound.priceMinor,
    currency: query.currency,
    market: query.market,
    adults: query.adults,
    childAges: [],
    cabin: query.cabin,
    baggage: { known: false, included: null, checkedBags: null },
    expiresAt: null,
    link: googleFlightsUrl({ ...query, segments }),
    stops: Math.max(
      outbound.segments.length - 1,
      (inbound?.segments.length ?? 1) - 1,
    ),
    durationMinutes: Math.max(outbound.duration, inbound?.duration ?? 0),
    segments,
  };
}

export function createSerpApiProvider(options: SerpApiOptions): FlightProvider {
  return {
    id: "serpapi",
    version: "1",
    allowsCache: true,
    retainsHistory: true,
    cacheTtlMs: 30 * 60 * 1000,
    async search(query) {
      const params = searchParams(query);
      const body = await searchRequest(
        params,
        options,
        query.returnDate ? 2 : 1,
      );
      const outbound = legsFrom(body, query, false);
      if (!query.returnDate)
        return { offers: outbound.map((leg) => offer(query, leg)) };
      if (outbound.length === 0) return { offers: [] };
      // One departure selection per combination keeps each round trip to two search credits.
      const selected = outbound.find((leg) => leg.departureToken);
      if (!selected)
        fail(
          "A SerpApi não informou como consultar o voo de volta.",
          "SERPAPI_RETURN_TOKEN",
        );
      const returns = new URLSearchParams(params);
      returns.set("departure_token", selected.departureToken!);
      const returnBody = await searchRequest(returns, options);
      const inbound = legsFrom(returnBody, query, true);
      return { offers: inbound.map((leg) => offer(query, selected, leg)) };
    },
  };
}
