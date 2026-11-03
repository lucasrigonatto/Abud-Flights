import { LIMITS } from "../domain/limits";
import { ProviderError } from "../domain/provider";

export function providerSettings(env: NodeJS.ProcessEnv = process.env) {
  const name = env.FLIGHT_PROVIDER?.trim() || "simulator";
  if (name !== "simulator" && name !== "serpapi") {
    throw new ProviderError(
      "O fornecedor de passagens não foi configurado corretamente.",
      {
        temporary: false,
        code: "PROVIDER_CONFIGURATION",
      },
    );
  }
  return {
    name,
    live: name === "serpapi",
    roundLimit: name === "serpapi" ? 1 : LIMITS.maxCombinationsPerRound,
    costPerSearchMinor: name === "serpapi" ? 0 : LIMITS.costPerSearchMinor,
    maxAttempts: name === "serpapi" ? 1 : LIMITS.providerRetryAttempts,
  };
}

export function freeSearchLimit(env: NodeJS.ProcessEnv = process.env): number {
  const value = env.SERPAPI_MONTHLY_SEARCH_LIMIT?.trim() || "200";
  const limit = Number(value);
  if (
    !/^\d+$/.test(value) ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 250
  ) {
    throw new ProviderError(
      "Defina um limite de 1 a 250 consultas mensais para a SerpApi.",
      {
        temporary: false,
        code: "SERPAPI_CONFIGURATION",
      },
    );
  }
  return limit;
}
