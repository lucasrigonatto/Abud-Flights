import type { BudgetScope, Cabin, PriceKind } from "./provider";
import type { MonitorLifecycle } from "./schedule";
import type { RunStatus } from "./coverage";

export function priceKindLabel(kind: PriceKind): string {
  if (kind === "DEMONSTRATION") return "Preço de demonstração";
  if (kind === "LIVE_INDICATIVE") return "Preço indicativo";
  return "Tarifa ao vivo";
}

export function cabinLabel(cabin: Cabin): string {
  if (cabin === "ECONOMY") return "Econômica";
  if (cabin === "PREMIUM_ECONOMY") return "Econômica premium";
  if (cabin === "BUSINESS") return "Executiva";
  return "Primeira classe";
}

export function monitorStatusLabel(status: MonitorLifecycle): string {
  if (status === "ACTIVE") return "Ativo";
  if (status === "PAUSED") return "Pausado";
  if (status === "CANCELLED") return "Cancelado";
  return "Encerrado";
}

export function runStatusLabel(status: RunStatus): string {
  if (status === "SUCCESS") return "Concluída";
  if (status === "FAILED") return "Falhou";
  if (status === "PARTIAL") return "Parcial";
  if (status === "NO_OFFERS") return "Sem ofertas";
  return "Em andamento";
}

export function budgetScopeLabel(scope: BudgetScope): string {
  return scope === "PER_PERSON" ? "por pessoa" : "para todos os passageiros";
}

export function stopsLabel(stops: number): string {
  if (stops <= 0) return "Voo direto";
  if (stops === 1) return "1 conexão";
  return `${stops} conexões`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

export function passengerLabel(adults: number, childCount: number): string {
  const adultText = adults === 1 ? "1 adulto" : `${adults} adultos`;
  if (childCount <= 0) return adultText;
  const childText = childCount === 1 ? "1 criança" : `${childCount} crianças`;
  return `${adultText} e ${childText}`;
}

export function offerFreshness(expiresAt: Date | null, now: Date): "sem_validade" | "vigente" | "expirada" {
  if (!expiresAt) return "sem_validade";
  return expiresAt.getTime() > now.getTime() ? "vigente" : "expirada";
}
