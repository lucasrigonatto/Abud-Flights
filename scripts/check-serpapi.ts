import { checkSerpApiAccount } from "../src/providers/serpapi";
import { freeSearchLimit } from "../src/providers/settings";
import { ProviderError } from "../src/domain/provider";

async function main() {
  try {
    const status = await checkSerpApiAccount({
      apiKey: process.env.SERPAPI_API_KEY,
      monthlyLimit: freeSearchLimit(),
    });
    console.log(
      JSON.stringify(
        { provider: "SerpApi", mode: "Free only", ...status },
        null,
        2,
      ),
    );
    console.log("Account check only. No flight search was performed.");
  } catch (error) {
    console.error(
      error instanceof ProviderError
        ? error.message
        : "Account validation failed.",
    );
    process.exitCode = 1;
  }
}

void main();
