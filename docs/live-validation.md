# Live flight-data validation

Checked on November 3, 2026 using SerpApi's Free plan.

## Search

```bash
npm run api:flight -- GRU BKK 2027-02-10
```

- Origin: São Paulo/Guarulhos (GRU).
- Destination: Bangkok/Suvarnabhumi (BKK).
- Departure: February 10, 2027.
- Journey: one way, one adult, economy.
- Currency: BRL.

## Observed result

The provider returned 11 offers that passed the application's normalization. The lowest returned fare was **BRL 3,216.00** (321600 minor units).

Its itinerary was:

1. GRU → JFK — AA950, departing February 10 at 23:00 local time.
2. JFK → AUH — EY2, departing February 11 at 15:00 local time.
3. AUH → BKK — EY400, departing February 12 at 14:20 local time.

The itinerary has two connections. Checked baggage was not confirmed. This is a recorded price observation, not a guaranteed available fare or a reservation.

## Free-quota check

The account check confirmed the Free plan before the search. Afterward, reported monthly usage increased from 0 to 1, with 249 searches remaining in the plan and 199 remaining under the application's configured threshold of 200. The account-check requests did not consume flight-search credits.

## What this validates

- The locally configured key can access the Free plan.
- A real flight request returns data through the provider adapter.
- BRL prices are converted into integer minor units.
- Airline segments, airport codes, and local departure/arrival times survive normalization.
- Account usage reflects one consumed flight search.

The automated suite separately passed 63 tests, including 27 provider tests with controlled responses. Type checking and the production build passed. Two PostgreSQL integration tests remain opt-in and were not executed in this check. The round-trip path has fixture coverage but was not queried live as part of this one-way validation.

No subscription change, extra-credit purchase, booking, or payment was made. Private credentials and account identity are excluded from this record.
