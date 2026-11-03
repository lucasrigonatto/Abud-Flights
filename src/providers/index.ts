import { createSimulator, type SimulatorMode } from "./simulator";
import type { FlightProvider } from "../domain/provider";
import { createSerpApiProvider } from "./serpapi";
import { freeSearchLimit, providerSettings } from "./settings";

export function getProvider(mode?: SimulatorMode): FlightProvider {
  if (mode || providerSettings().name === "simulator")
    return createSimulator({ mode: mode ?? "ok" });
  return createSerpApiProvider({
    apiKey: process.env.SERPAPI_API_KEY,
    monthlyLimit: freeSearchLimit(),
  });
}
