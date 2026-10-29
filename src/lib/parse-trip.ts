import { isoDateInTimeZone, shiftDate } from "../domain/dates";
import { LIMITS } from "../domain/limits";
import { parseMoneyToMinor } from "../domain/money";
import type { BudgetScope, Cabin, MonitorCriteria } from "../domain/provider";

const CABINS = new Set<Cabin>(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]);
const CURRENCIES = new Set(["BRL", "EUR", "USD"]);
const DURATIONS = new Set([8, 12, 20, 30]);

export type ParsedTrip = {
  criteria: MonitorCriteria;
  name: string;
  monitorUntil: string | null;
  targetAmountMinor: number | null;
  budgetScope: BudgetScope;
};

export function parseTripForm(
  formData: FormData,
  validIatas: Set<string>,
  mode: "search" | "monitor",
  today = isoDateInTimeZone(new Date()),
): { ok: true; value: ParsedTrip } | { ok: false; error: string } {
  const origins = uniqueCodes([
    readCode(formData, "origin"),
    readCode(formData, "originAlt1"),
    readCode(formData, "originAlt2"),
  ]);
  if (!origins.ok) return origins;
  const destinations = uniqueCodes([
    readCode(formData, "destination"),
    readCode(formData, "destinationAlt1"),
    readCode(formData, "destinationAlt2"),
  ]);
  if (!destinations.ok) return destinations;
  if (origins.codes.length === 0 || destinations.codes.length === 0) {
    return { ok: false, error: "Informe a origem e o destino." };
  }
  if (origins.codes.length > LIMITS.maxAirportsPerSide || destinations.codes.length > LIMITS.maxAirportsPerSide) {
    return { ok: false, error: "Escolha no máximo dois aeroportos alternativos de cada lado." };
  }
  const unknown = [...origins.codes, ...destinations.codes].find((code) => !validIatas.has(code));
  if (unknown) return { ok: false, error: `O aeroporto ${unknown} não está na lista disponível.` };
  if (origins.codes.some((code) => destinations.codes.includes(code))) {
    return { ok: false, error: "Origem e destino precisam ser aeroportos diferentes." };
  }

  const departDate = String(formData.get("departDate") ?? "");
  const returnDate = String(formData.get("returnDate") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(departDate) || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate)) {
    return { ok: false, error: "Informe as datas de ida e volta." };
  }
  if (departDate < today) return { ok: false, error: "A data de ida já passou." };
  if (returnDate <= departDate) return { ok: false, error: "A volta precisa ser depois da ida." };
  const horizon = shiftDate(today, 730);
  if (departDate > horizon || returnDate > horizon) {
    return { ok: false, error: "As datas precisam estar nos próximos dois anos." };
  }

  const flexDays = Number(formData.get("flexDays") ?? 0);
  if (!LIMITS.allowedFlexDays.includes(flexDays as (typeof LIMITS.allowedFlexDays)[number])) {
    return { ok: false, error: "A flexibilidade disponível é de datas fixas, ±1 dia ou ±3 dias." };
  }

  const adults = Number(formData.get("adults") ?? 1);
  if (!Number.isInteger(adults) || adults < 1 || adults > LIMITS.maxAdults) {
    return { ok: false, error: "Informe de 1 a 6 adultos." };
  }
  const childAges = parseAges(String(formData.get("childAges") ?? ""));
  if (!childAges.ok) return childAges;

  const cabin = String(formData.get("cabin") ?? "ECONOMY") as Cabin;
  if (!CABINS.has(cabin)) return { ok: false, error: "Escolha a cabine." };

  const bagsRaw = String(formData.get("bags") ?? "");
  let checkedBags: number | null = null;
  if (bagsRaw !== "" && bagsRaw !== "unset") {
    const bags = Number(bagsRaw);
    if (![0, 1, 2].includes(bags)) return { ok: false, error: "A bagagem desejada é 0, 1 ou 2 malas." };
    checkedBags = bags;
  }

  const currency = String(formData.get("currency") ?? "BRL");
  if (!CURRENCIES.has(currency)) return { ok: false, error: "Escolha a moeda da consulta." };
  const market = String(formData.get("market") ?? "BR").toUpperCase();
  if (!/^[A-Z]{2}$/.test(market)) return { ok: false, error: "Informe o mercado de venda com duas letras." };

  const maxStops = Number(formData.get("maxStops") ?? 1);
  if (![0, 1, 2].includes(maxStops)) return { ok: false, error: "O limite de conexões é 0, 1 ou 2." };
  const durationHours = Number(formData.get("maxDurationHours") ?? 20);
  if (!DURATIONS.has(durationHours)) return { ok: false, error: "Escolha a duração máxima por sentido." };

  const criteria: MonitorCriteria = {
    origins: origins.codes,
    destinations: destinations.codes,
    dateMode: flexDays === 0 ? "FIXED" : "FLEX",
    departDate,
    returnDate,
    flexDays,
    adults,
    childAges: childAges.ages,
    cabin,
    checkedBags,
    currency,
    market,
    maxStops,
    maxDurationMinutes: durationHours * 60,
  };

  if (mode === "search") {
    return {
      ok: true,
      value: { criteria, name: `${origins.codes[0]} → ${destinations.codes[0]}`, monitorUntil: null, targetAmountMinor: null, budgetScope: "TOTAL" },
    };
  }

  const nameRaw = String(formData.get("name") ?? "").trim();
  const name = nameRaw || `${origins.codes[0]} → ${destinations.codes[0]}`;
  if (name.length < 2 || name.length > 80) return { ok: false, error: "Dê um nome de 2 a 80 caracteres ao monitoramento." };
  const monitorUntil = String(formData.get("monitorUntil") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(monitorUntil)) return { ok: false, error: "Informe até quando o monitoramento fica ativo." };
  const maxUntil = shiftDate(today, LIMITS.maxMonitorDays);
  if (monitorUntil < today || monitorUntil > maxUntil) {
    return { ok: false, error: `O monitoramento pode durar até ${LIMITS.maxMonitorDays} dias.` };
  }
  const scopeRaw = String(formData.get("budgetScope") ?? "TOTAL");
  if (scopeRaw !== "TOTAL" && scopeRaw !== "PER_PERSON") {
    return { ok: false, error: "Diga se o preço-alvo é por pessoa ou para todos os passageiros." };
  }
  const targetAmountMinor = parseMoneyToMinor(String(formData.get("targetAmount") ?? ""), currency);
  if (targetAmountMinor === null || targetAmountMinor <= 0) {
    return { ok: false, error: "Informe um preço-alvo maior que zero na moeda da consulta." };
  }

  return {
    ok: true,
    value: { criteria, name, monitorUntil, targetAmountMinor, budgetScope: scopeRaw },
  };
}

function readCode(formData: FormData, field: string): string {
  return String(formData.get(field) ?? "")
    .trim()
    .toUpperCase();
}

function uniqueCodes(codes: string[]): { ok: true; codes: string[] } | { ok: false; error: string } {
  const present = codes.filter((code) => code.length > 0);
  for (const code of present) {
    if (!/^[A-Z]{3}$/.test(code)) return { ok: false, error: `Use o código IATA de três letras. “${code}” não serve.` };
  }
  const unique = [...new Set(present)];
  if (unique.length !== present.length) {
    return { ok: false, error: "Não repita o mesmo aeroporto no mesmo lado da viagem." };
  }
  return { ok: true, codes: unique };
}

function parseAges(value: string): { ok: true; ages: number[] } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, ages: [] };
  const parts = trimmed.split(/[,\s]+/).filter(Boolean);
  if (parts.length > LIMITS.maxChildren) {
    return { ok: false, error: `Informe no máximo ${LIMITS.maxChildren} crianças.` };
  }
  const ages: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,2}$/.test(part)) return { ok: false, error: "As idades das crianças são números de 0 a 17." };
    const age = Number(part);
    if (age > 17) return { ok: false, error: "As idades das crianças são números de 0 a 17." };
    ages.push(age);
  }
  return { ok: true, ages };
}
