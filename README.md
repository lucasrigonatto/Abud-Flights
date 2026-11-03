# Abud Flights

A flight-search and price-monitoring app built with Next.js, TypeScript, Prisma, and PostgreSQL. It supports a simulator for offline development and a SerpApi integration restricted to the Free plan.

![Abud Flights public home page with an illustrative route map.](docs/screenshots/home.jpg)

The map on the public home page explains route selection; it does not display a live fare.

## What problem does it solve?

Comparing different dates and nearby airports manually is repetitive. Abud Flights saves search criteria, records price observations, and checks monitored trips on a schedule. The interface keeps the price source, currency, passenger count, and collection time visible.

## How is it structured?

The Next.js application handles accounts, searches, monitoring settings, and result views. Domain modules handle date combinations, monetary amounts, historical comparisons, and alert rules. Provider adapters translate external responses into the same validated offer model, keeping simulated and live observations distinct.

Prisma persists monitors, immutable price observations, search runs, and notifications in PostgreSQL. A separate worker claims due monitors, performs bounded search rounds, and uses unique run and notification keys to avoid duplicate observations or alerts when a round is retried. Docker Compose runs the database, web application, and worker as separate services.

## What is implemented?

- Worldwide airport search, one-way and round-trip journeys.
- Fixed dates, flexible date windows, and manually selected alternative airports.
- Accounts with access limited to their own searches, monitors, and notifications.
- Append-only history and idempotent monitor rounds.
- Price-target, percentage-drop, new-low, and alternative-airport savings alerts.
- A separate worker that checks active monitors every 12 hours.
- PostgreSQL persistence, a route map, and source links.
- Free-only SerpApi checks before external searches, with visible quota feedback.

## Configure real prices

Follow [SerpApi Free setup](docs/serpapi-setup.md). Put the key in the ignored `.env.local` file, then run:

```bash
npm run api:check
```

The account check does not consume flight-search credits. Live flight checks require a configured key. No API key is stored in this repository.

The initial real-data integration accepts **one adult, without children**. Round trips select one departure before fetching return options. Checked-baggage allowances are left unknown unless confirmed. These limits are explicit in the app and documentation; the simulator remains available for broader offline scenarios.

## Run with Docker

Requires Docker Desktop/Engine and Compose. For an offline demonstration, copy `.env.example` to `.env.local`, keep `FLIGHT_PROVIDER=simulator`, then run:

```bash
docker compose --env-file .env.local up --build
```

Open http://localhost:3000 and create a local account. Compose starts PostgreSQL, the web application, and the monitoring worker. The web service applies the existing migrations and seeds the airport data. The database stays in the `abud_pg` volume across ordinary restarts. The sample database credentials are for local development.

For live prices, follow the provider setup guide above and configure your own private key. For a local Node.js workflow with an existing PostgreSQL server, see the [local setup commands](docs/serpapi-setup.md#run-the-website-and-worker).

## How do I know it works?

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Automated tests cover domain behavior, search criteria, flight links, route maps, error handling, quota checks, and real-provider response mapping using fixtures. They make no live flight requests.

GitHub Actions runs the same checks against an isolated PostgreSQL service, including migrations, airport seeding, and the two opt-in persistence tests. CI always selects the simulator and requires no external flight API key.

Two PostgreSQL integration tests are opt-in because they clear test records. Set `RUN_DATABASE_TESTS=true` and `DATABASE_URL` to a dedicated disposable test database before running them. They must not use an application database containing user data.

A [live one-way validation](docs/live-validation.md) on November 3, 2026 returned 11 offers for GRU → BKK on February 10, 2027 and confirmed that one Free-plan search was consumed. The automated suite passed 63 tests; type checking and the production build also passed.

Each installation still needs its own key and account verification using the setup guide. A recorded live result does not guarantee future provider availability or the continued availability of a particular fare.

## Project structure

- `src/app/`: pages, server actions, authentication, search results, and monitoring views.
- `src/domain/`: search planning, pricing, scheduling, history, and alert behavior.
- `src/providers/`: simulator and SerpApi adapters, response validation, and quota checks.
- `src/infra/`: Prisma persistence, monitor ownership, and execution coordination.
- `src/worker/`: periodic background monitoring process.
- `prisma/`: relational schema, migrations, and airport seed data.
- `tests/`: domain, provider, map, link, and persistence checks.
- `docs/`: provider setup and the recorded live validation.

## Scope and limits

Monitoring is periodic, so short promotions can be missed. Flexible searches are bounded; the lowest result is only the lowest among the options actually queried. A missing supplier response is recorded as a failure rather than a false absence of flights.

The app does not issue tickets, collect payments, or change reservations. Source-site prices and availability may change. The interface is currently in Portuguese; repository documentation and new integration code are in English.

Alerts are presented in the application; external email delivery is not implemented. Live multi-passenger pricing, broad production deployment, and a live round-trip validation remain further work. The PostgreSQL tests are verified separately from the recorded one-way provider check.

Keep `.env.local`, API keys, local database contents, and account information out of commits and screenshots. A public deployment needs its own HTTPS configuration, secure cookies, and persistent database. Running this repository locally does not publish a hosted service.
