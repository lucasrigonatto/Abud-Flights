import { createSerpApiProvider } from "../src/providers/serpapi";
import { freeSearchLimit } from "../src/providers/settings";
import { ProviderError } from "../src/domain/provider";

async function main() {
  const [origin, destination, departDate, returnDate] = process.argv.slice(2);
  if (!origin || !destination || !departDate) {
    console.error(
      "Usage: npm run api:flight -- GRU GIG YYYY-MM-DD [YYYY-MM-DD]",
    );
    process.exitCode = 1;
    return;
  }
  try {
    const provider = createSerpApiProvider({
      apiKey: process.env.SERPAPI_API_KEY,
      monthlyLimit: freeSearchLimit(),
    });
    const result = await provider.search({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departDate,
      returnDate: returnDate ?? null,
      adults: 1,
      childAges: [],
      cabin: "ECONOMY",
      checkedBags: null,
      currency: "BRL",
      market: "BR",
      maxStops: null,
      maxDurationMinutes: 72 * 60,
    });
    const lowest = [...result.offers].sort(
      (a, b) => a.totalAmountMinor - b.totalAmountMinor,
    )[0];
    console.log(
      JSON.stringify(
        {
          provider: provider.id,
          offers: result.offers.length,
          lowestAmountMinor: lowest?.totalAmountMinor ?? null,
          currency: lowest?.currency ?? "BRL",
          priceKind: lowest?.priceKind ?? null,
          segments: lowest?.segments ?? [],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      error instanceof ProviderError
        ? error.message
        : "Flight validation failed.",
    );
    process.exitCode = 1;
  }
}

void main();
