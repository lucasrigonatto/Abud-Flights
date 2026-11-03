import { describe, expect, it, vi } from "vitest";
import {
  createSerpApiProvider,
  checkSerpApiAccount,
} from "../src/providers/serpapi";
import { freeSearchLimit, providerSettings } from "../src/providers/settings";
import type { ProviderQuery } from "../src/domain/provider";

const key = "private-test-value";
const query: ProviderQuery = {
  origin: "GRU",
  destination: "GIG",
  departDate: "2027-02-10",
  returnDate: null,
  adults: 1,
  childAges: [],
  cabin: "ECONOMY",
  checkedBags: 1,
  currency: "BRL",
  market: "BR",
  maxStops: 1,
  maxDurationMinutes: 1000,
};
const account = (extra = {}) => ({
  account_status: "Active",
  plan_monthly_price: 0,
  searches_per_month: 250,
  extra_credits: 0,
  this_month_usage: 20,
  plan_searches_left: 230,
  last_hour_searches: 1,
  account_rate_limit_per_hour: 50,
  ...extra,
});
const leg = (extra = {}) => ({
  flights: [
    {
      departure_airport: { id: "GRU", time: "2027-02-10 10:00" },
      arrival_airport: { id: "GIG", time: "2027-02-10 11:10" },
      airline: "LATAM",
      flight_number: "LA 3000",
    },
  ],
  total_duration: 70,
  price: 351.25,
  departure_token: "selected-outbound",
  ...extra,
});
const response = (rows: unknown[], currency = "BRL") => ({
  search_parameters: { currency },
  other_flights: rows,
});
const inbound = () =>
  leg({
    flights: [
      {
        departure_airport: { id: "GIG", time: "2027-02-17 18:00" },
        arrival_airport: { id: "GRU", time: "2027-02-17 19:20" },
        airline: "LATAM",
        flight_number: "LA 3001",
      },
    ],
    total_duration: 80,
    price: 640,
  });
function mockApi(
  searches: unknown[] = [response([leg()])],
  accounts = [account()],
) {
  let accountIndex = 0;
  const mock = vi.fn(async (url: string) => {
    const target = new URL(url);
    const data =
      target.pathname === "/account.json"
        ? accounts[Math.min(accountIndex++, accounts.length - 1)]
        : searches.shift();
    if (data === undefined) throw new Error("Unexpected request");
    return new Response(JSON.stringify(data), { status: 200 });
  });
  return {
    mock,
    fetchImpl: mock as unknown as typeof fetch,
    searches: () =>
      mock.mock.calls
        .map(([url]) => new URL(url))
        .filter((url) => url.pathname === "/search.json"),
  };
}

describe("SerpApi Free integration", () => {
  it("returns only the public quota fields, excluding key and account identity", async () => {
    const api = mockApi(
      [],
      [account({ api_key: key, account_email: "private@example.test" })],
    );
    const status = await checkSerpApiAccount({
      apiKey: key,
      fetchImpl: api.fetchImpl,
    });
    expect(status).toMatchObject({
      monthlyUsed: 20,
      projectRemaining: 180,
      projectLimit: 200,
    });
    expect(JSON.stringify(status)).not.toContain(key);
    expect(JSON.stringify(status)).not.toContain("private@example.test");
    expect(api.searches()).toHaveLength(0);
  });

  it("sends a server-side search and maps a real one-way quote without invented baggage", async () => {
    const api = mockApi();
    const result = await createSerpApiProvider({
      apiKey: key,
      fetchImpl: api.fetchImpl,
    }).search(query);
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]).toMatchObject({
      totalAmountMinor: 35125,
      currency: "BRL",
      priceKind: "LIVE_CURRENT",
      adults: 1,
      baggage: { known: false, included: null, checkedBags: null },
      expiresAt: null,
    });
    expect(result.offers[0].segments[0]).toMatchObject({
      origin: "GRU",
      destination: "GIG",
      flightNumber: "LA3000",
      departLocal: "2027-02-10T10:00:00",
    });
    const params = api.searches()[0].searchParams;
    expect(params.get("type")).toBe("2");
    expect(params.get("departure_id")).toBe("GRU");
    expect(params.get("currency")).toBe("BRL");
    expect(params.get("no_cache")).toBe("true");
    expect(params.has("bags")).toBe(false);
    expect(result.offers[0].link).toContain(
      "https://www.google.com/travel/flights/booking?",
    );
    expect(result.offers[0].link).not.toContain(key);
  });

  it("selects an outbound and fetches the return, keeping the whole trip price", async () => {
    const api = mockApi([response([leg()]), response([inbound()])]);
    const result = await createSerpApiProvider({
      apiKey: key,
      fetchImpl: api.fetchImpl,
    }).search({ ...query, returnDate: "2027-02-17" });
    expect(result.offers[0].totalAmountMinor).toBe(64000);
    expect(result.offers[0].segments.map((s) => s.flightNumber)).toEqual([
      "LA3000",
      "LA3001",
    ]);
    expect(result.offers[0].durationMinutes).toBe(80);
    expect(api.searches()).toHaveLength(2);
    expect(api.searches()[1].searchParams.get("departure_token")).toBe(
      "selected-outbound",
    );
    expect(
      api.mock.mock.calls.filter(
        ([url]) => new URL(url).pathname === "/account.json",
      ),
    ).toHaveLength(2);
  });

  it("keeps the itinerary identifier stable when only the quote changes", async () => {
    const api = mockApi([response([leg()]), response([leg({ price: 500 })])]);
    const provider = createSerpApiProvider({
      apiKey: key,
      fetchImpl: api.fetchImpl,
    });
    const first = await provider.search(query),
      second = await provider.search(query);
    expect(first.offers[0].providerOfferId).toBe(
      second.offers[0].providerOfferId,
    );
    expect(first.offers[0].totalAmountMinor).not.toBe(
      second.offers[0].totalAmountMinor,
    );
  });

  it.each([
    [
      "a paid plan",
      account({ plan_monthly_price: 25, searches_per_month: 1000 }),
      "SERPAPI_FREE_ONLY",
    ],
    [
      "the project cap",
      account({ this_month_usage: 200, plan_searches_left: 50 }),
      "SERPAPI_QUOTA",
    ],
    [
      "an exhausted free quota",
      account({ plan_searches_left: 0 }),
      "SERPAPI_QUOTA",
    ],
    [
      "extra credits that might allow overage",
      account({ extra_credits: 100 }),
      "SERPAPI_FREE_ONLY",
    ],
    ["the hourly quota", account({ last_hour_searches: 50 }), "SERPAPI_QUOTA"],
    [
      "an inactive account",
      account({ account_status: "Inactive" }),
      "SERPAPI_ACCOUNT_INACTIVE",
    ],
    [
      "unverifiable usage",
      account({ this_month_usage: undefined }),
      "SERPAPI_ACCOUNT_RESPONSE",
    ],
  ])("blocks %s before any flight request", async (_label, details, code) => {
    const api = mockApi([], [details]);
    await expect(
      createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search(
        query,
      ),
    ).rejects.toMatchObject({ code, temporary: false });
    expect(api.searches()).toHaveLength(0);
  });

  it("requires enough credits for both steps before starting a round trip", async () => {
    const api = mockApi([], [account({ this_month_usage: 199 })]);
    await expect(
      createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search({
        ...query,
        returnDate: "2027-02-17",
      }),
    ).rejects.toMatchObject({ code: "SERPAPI_QUOTA" });
    expect(api.searches()).toHaveLength(0);
  });

  it("rechecks quota before the return and never saves an incomplete round-trip quote", async () => {
    const api = mockApi(
      [response([leg()])],
      [account(), account({ this_month_usage: 200 })],
    );
    await expect(
      createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search({
        ...query,
        returnDate: "2027-02-17",
      }),
    ).rejects.toMatchObject({ code: "SERPAPI_QUOTA" });
    expect(api.searches()).toHaveLength(1);
  });

  it("does not fall back to a simulated price when a key is missing", async () => {
    const api = mockApi();
    await expect(
      createSerpApiProvider({ apiKey: "", fetchImpl: api.fetchImpl }).search(
        query,
      ),
    ).rejects.toMatchObject({ code: "SERPAPI_MISSING_KEY" });
    expect(api.mock).not.toHaveBeenCalled();
  });

  it.each([{ adults: 2 }, { childAges: [8] }, { hasChildren: true }])(
    "rejects unsupported passenger pricing without using credits: %j",
    async (passengers) => {
      const api = mockApi();
      await expect(
        createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search(
          { ...query, ...passengers },
        ),
      ).rejects.toMatchObject({ code: "SERPAPI_PASSENGERS_UNSUPPORTED" });
      expect(api.mock).not.toHaveBeenCalled();
    },
  );

  it("accepts an explicit empty result", async () => {
    const api = mockApi([response([])]);
    await expect(
      createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search(
        query,
      ),
    ).resolves.toEqual({ offers: [] });
  });

  it.each([
    [response([leg()], "USD"), "SERPAPI_RESPONSE"],
    [response([leg({ flights: [] })]), "SERPAPI_ITINERARY"],
    [response([leg({ price: -10 })]), "SERPAPI_ITINERARY"],
    [{ search_parameters: { currency: "BRL" } }, "SERPAPI_RESPONSE"],
  ])(
    "fails closed for malformed or mismatched flight data",
    async (body, code) => {
      const api = mockApi([body]);
      await expect(
        createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search(
          query,
        ),
      ).rejects.toMatchObject({ code });
    },
  );

  it("does not invent a return when the departure token is missing", async () => {
    const api = mockApi([response([leg({ departure_token: null })])]);
    await expect(
      createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search({
        ...query,
        returnDate: "2027-02-17",
      }),
    ).rejects.toMatchObject({ code: "SERPAPI_RETURN_TOKEN" });
    expect(api.searches()).toHaveLength(1);
  });

  it("does not expose credentials from provider failures", async () => {
    const api = mockApi([{ error: "Invalid key: " + key }]);
    await expect(
      createSerpApiProvider({ apiKey: key, fetchImpl: api.fetchImpl }).search(
        query,
      ),
    ).rejects.not.toThrow(key);
  });

  it("does not expose credentials from network errors", async () => {
    const api = vi
      .fn()
      .mockRejectedValue(new Error("Request failed: api_key=" + key));
    await expect(
      checkSerpApiAccount({ apiKey: key, fetchImpl: api }),
    ).rejects.toMatchObject({ code: "SERPAPI_UNAVAILABLE" });
    await expect(
      checkSerpApiAccount({ apiKey: key, fetchImpl: api }),
    ).rejects.not.toThrow(key);
  });

  it("does not retry a provider quota response", async () => {
    const api = vi
      .fn()
      .mockResolvedValue(new Response("limit", { status: 429 }));
    await expect(
      checkSerpApiAccount({ apiKey: key, fetchImpl: api }),
    ).rejects.toMatchObject({ code: "SERPAPI_QUOTA", temporary: false });
  });

  it("applies strict free-mode configuration without changing simulator limits", () => {
    expect(providerSettings({ FLIGHT_PROVIDER: "serpapi" })).toMatchObject({
      roundLimit: 1,
      maxAttempts: 1,
      costPerSearchMinor: 0,
    });
    expect(providerSettings({ FLIGHT_PROVIDER: "simulator" }).roundLimit).toBe(
      8,
    );
    expect(() => providerSettings({ FLIGHT_PROVIDER: "other" })).toThrow();
    expect(freeSearchLimit({})).toBe(200);
    expect(() =>
      freeSearchLimit({ SERPAPI_MONTHLY_SEARCH_LIMIT: "251" }),
    ).toThrow();
  });
});
