import { createSimulator, type SimulatorMode } from "./simulator";
import type { FlightProvider } from "../domain/provider";

export function getProvider(mode: SimulatorMode = "ok"): FlightProvider {
  return createSimulator({ mode });
}
