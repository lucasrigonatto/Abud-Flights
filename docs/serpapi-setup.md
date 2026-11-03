# SerpApi Free setup

Abud Flights can query Google Flights data through SerpApi. This integration uses the Free plan only. It does not create bookings, take payments, purchase credits, or change the subscription.

## Store the key locally

1. Open [Your API Key](https://serpapi.com/manage-api-key) in the SerpApi dashboard.
2. Copy the private API key.
3. Open `.env.local` in the project root. If it does not exist, copy `.env.example` first. Preserve existing configuration.
4. Set the following values, putting the private key after `SERPAPI_API_KEY=`:

```dotenv
FLIGHT_PROVIDER=serpapi
SERPAPI_API_KEY=
SERPAPI_MONTHLY_SEARCH_LIMIT=200
```

Never add the key to a `NEXT_PUBLIC_` variable, source file, commit, screenshot, or message. `.env.local` is excluded from Git and the Docker build context.

## Verify the account

```bash
npm run api:check
```

The command checks the subscription and quota through the [Account API](https://serpapi.com/account-api). This endpoint is free and does not count as a flight search. Output contains only safe quota fields; it omits the key, account ID, and email address.

The client refuses paid plans, extra-credit accounts, inactive accounts, and responses that cannot confirm the Free plan. A missing key produces a configuration error, with no fallback to simulated fares.

## Check one real search

```bash
npm run api:flight -- GRU GIG 2026-12-15
```

Use future dates. A one-way search uses one flight request. To check a round trip:

```bash
npm run api:flight -- GRU GIG 2026-12-15 2026-12-22
```

A round trip uses up to two flight requests: an outbound search and a return search for one selected departure. The return quote supplies the whole round-trip amount; the app does not add it to the initial outbound quote. No partial outbound-only itinerary is stored as a complete round trip.

## Run the website and worker

With Docker Desktop running:

```bash
docker compose --env-file .env.local up --build
```

The web and worker services both receive the provider settings. The private environment file is not copied into the image. Open http://localhost:3000.

For local Node.js development with your own PostgreSQL instance:

```bash
npm ci
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Next.js reads `.env.local` for the web server. In a separate terminal, run `npm run worker:local` to load the same file for the worker. The local migration and seed commands load `DATABASE_URL` from the same private file. Do not point migration or test commands at an unrelated database.

## Free usage controls

- The provider currently advertises [250 free searches per month](https://serpapi.com/pricing). The application defaults to a conservative account-wide threshold of 200.
- The client checks account usage before every flight request, including the return leg. It reserves enough remaining quota before starting a round trip.
- Account-wide usage includes requests made by other apps using the same SerpApi account. The threshold follows the provider's billing cycle, not the application's calendar-month report.
- The account check also respects the hourly limit. Quota failures are not automatically retried within a search.
- The threshold is checked against reported usage; simultaneous external requests can change that usage. The provider's Free quota remains the final enforcement point. Paid plans and extra credits are rejected.
- Each search/monitor round queries one date/airport combination. For round trips, it explores returns for one departure. Results are a bounded selection, not a claim to cover every possible flight.
- A fixed-date round trip monitored twice daily can use about 120 flight searches in 30 days. Multiple monitors, manual searches, flexible dates, and alternative airports share the same allowance.
- Application cache entries retain the original collection time and are reused for up to 30 minutes. New provider requests set `no_cache=true` for a fresh upstream search.

## Initial coverage

Real searches currently support one adult without children. This avoids assigning an unverified group price to multiple passengers. Multi-passenger support needs a separate validation of the provider's price scope before enabling it.

Checked baggage remains unknown when it is not confirmed. SerpApi's `bags` option represents carry-on bags, so it is deliberately not used for the application's checked-baggage setting. Prices can change before a user reaches the source website, and the provider does not supply a guaranteed offer expiration time.

Use `FLIGHT_PROVIDER=simulator` for offline development. Existing simulated observations keep their demonstration label and remain separate from live price history.

## Validation

Provider tests use mocked responses and cover quota enforcement, paid-plan rejection, request parameters, prices, full round trips, malformed responses, missing keys, and redacted errors. A passing test suite is not proof that a particular live account or route is available. Run the account check and a controlled flight search after configuring the key.
