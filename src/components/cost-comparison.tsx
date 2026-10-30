"use client";

import { useMemo, useState } from "react";
import { formatMoney, minorToInput, parseMoneyToMinor } from "../domain/money";
import { compareAlternate, formatCost, quoteRoute, totalCost, UNKNOWN_COST_LABEL, type AirportCost } from "../domain/trip-cost";

export type CostOffer = {
  id: string;
  origin: string;
  destination: string;
  fareMinor: number;
  currency: string;
  durationMinutes: number;
  baggageKnown: boolean;
  baggageIncluded: boolean | null;
  checkedBags: number | null;
  priceKind: string;
};

type CostSeed = {
  requiredBags: number | null;
  extraBagAmountMinor: number | null;
  costs: AirportCost[];
  primaryOrigin?: string;
  primaryDestination?: string;
};

function moneyState(amount: number | null): string {
  if (amount === null) return "";
  return minorToInput(amount, "BRL");
}

function parseField(raw: string, currency: string): number | null | "invalid" {
  if (!raw.trim()) return null;
  const parsed = parseMoneyToMinor(raw, currency);
  return parsed === null ? "invalid" : parsed;
}

export function CostComparison({ offers, seed }: { offers: CostOffer[]; seed?: CostSeed }) {
  const current = offers.filter((offer) => offer.priceKind !== "LIVE_INDICATIVE");
  const indicative = offers.filter((offer) => offer.priceKind === "LIVE_INDICATIVE");
  const currency = current[0]?.currency ?? offers[0]?.currency ?? "BRL";
  const routes = useMemo(() => {
    const grouped = new Map<string, CostOffer>();
    for (const offer of current.filter((item) => item.currency === currency)) {
      const key = `${offer.origin}|${offer.destination}`;
      const existing = grouped.get(key);
      if (!existing || offer.fareMinor < existing.fareMinor) grouped.set(key, offer);
    }
    return [...grouped.values()];
  }, [currency, current]);
  const airports = [...new Set(routes.flatMap((route) => [route.origin, route.destination]))];
  const [bags, setBags] = useState(seed?.requiredBags === null || seed?.requiredBags === undefined ? "" : String(seed.requiredBags));
  const [extraBag, setExtraBag] = useState(seed?.extraBagAmountMinor == null ? "" : moneyState(seed.extraBagAmountMinor));
  const [fields, setFields] = useState<Record<string, { transfer: string; lodging: string; fees: string; minutes: string }>>(() => {
    const initial: Record<string, { transfer: string; lodging: string; fees: string; minutes: string }> = {};
    for (const airport of airports) {
      const saved = seed?.costs.find((cost) => cost.airport === airport);
      initial[airport] = {
        transfer: saved?.transferMinor == null ? "" : moneyState(saved.transferMinor),
        lodging: saved?.lodgingMinor == null ? "" : moneyState(saved.lodgingMinor),
        fees: saved?.feesMinor == null ? "" : moneyState(saved.feesMinor),
        minutes: saved?.transferMinutes == null ? "" : String(saved.transferMinutes),
      };
    }
    return initial;
  });

  if (routes.length === 0) {
    return (
      <section className="card stack">
        <h2>Custo da alternativa</h2>
        <p className="muted">Ainda não há oferta atual para somar bagagem, transfer, hospedagem e taxas.</p>
        {indicative.length > 0 ? <p className="notice">Preço indicativo. Não é uma oferta atual.</p> : null}
      </section>
    );
  }

  const requiredBags = bags === "" ? null : Number(bags);
  const extraBagAmount = parseField(extraBag, currency);
  const costs: AirportCost[] = airports.map((airport) => {
    const field = fields[airport] ?? { transfer: "", lodging: "", fees: "", minutes: "" };
    const minutesRaw = field.minutes.trim();
    const minutes = minutesRaw === "" ? null : /^\d{1,4}$/.test(minutesRaw) ? Number(minutesRaw) : null;
    const transfer = parseField(field.transfer, currency);
    const lodging = parseField(field.lodging, currency);
    const fees = parseField(field.fees, currency);
    return {
      airport,
      transferMinor: transfer === "invalid" ? null : transfer,
      lodgingMinor: lodging === "invalid" ? null : lodging,
      feesMinor: fees === "invalid" ? null : fees,
      transferMinutes: minutes,
    };
  });

  const quotes = routes.map((route) => ({
    route,
    quote: quoteRoute({
      fareMinor: route.fareMinor,
      origin: route.origin,
      destination: route.destination,
      durationMinutes: route.durationMinutes,
      requiredBags,
      baggageKnown: route.baggageKnown,
      baggageIncluded: route.baggageIncluded,
      includedBags: route.checkedBags,
      extraBagAmountMinor: extraBagAmount === "invalid" ? null : extraBagAmount,
      costs,
    }),
  }));
  const primary =
    quotes.find((item) => item.route.origin === seed?.primaryOrigin && item.route.destination === seed?.primaryDestination) ??
    quotes[0];

  function update(airport: string, key: "transfer" | "lodging" | "fees" | "minutes", value: string) {
    setFields((currentFields) => ({
      ...currentFields,
      [airport]: { ...(currentFields[airport] ?? { transfer: "", lodging: "", fees: "", minutes: "" }), [key]: value },
    }));
  }

  return (
    <section className="card stack" id="custo-alternativo">
      <h2>Custo da alternativa</h2>
      <p className="muted">
        Total = tarifa + bagagem exigida + transfer extra + hospedagem extra + taxas conhecidas. Você informa transfer e hospedagem. Em branco aparece como “{UNKNOWN_COST_LABEL}” e nunca como zero. A economia e o tempo extra só aparecem quando o alternativo continua mais barato depois desses custos.
      </p>
      <div className="form-grid">
        <label>
          Malas exigidas
          <select value={bags} onChange={(event) => setBags(event.target.value)}>
            <option value="">não informado</option>
            <option value="0">0</option>
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </label>
        <label>
          Preço de cada mala que falta
          <input value={extraBag} onChange={(event) => setExtraBag(event.target.value)} inputMode="decimal" placeholder="não informado" />
        </label>
      </div>
      {airports.map((airport) => {
        const field = fields[airport] ?? { transfer: "", lodging: "", fees: "", minutes: "" };
        return (
          <div key={airport} className="form-grid">
            <label>
              Transfer extra em {airport}
              <input value={field.transfer} onChange={(event) => update(airport, "transfer", event.target.value)} inputMode="decimal" placeholder="não informado" />
            </label>
            <label>
              Hospedagem extra em {airport}
              <input value={field.lodging} onChange={(event) => update(airport, "lodging", event.target.value)} inputMode="decimal" placeholder="não informado" />
            </label>
            <label>
              Taxas conhecidas em {airport}
              <input value={field.fees} onChange={(event) => update(airport, "fees", event.target.value)} inputMode="decimal" placeholder="não informado" />
            </label>
            <label>
              Minutos extras em {airport}
              <input value={field.minutes} onChange={(event) => update(airport, "minutes", event.target.value)} inputMode="numeric" placeholder="não informado" />
            </label>
          </div>
        );
      })}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rota</th>
              <th>Tarifa</th>
              <th>Bagagem</th>
              <th>Transfer</th>
              <th>Hospedagem</th>
              <th>Taxas</th>
              <th>Total</th>
              <th>Depois dos custos</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map(({ route, quote }) => {
              const comparison = route.id === primary.route.id ? null : compareAlternate(primary.quote, quote, currency);
              const total = totalCost(quote);
              return (
                <tr key={route.id}>
                  <td>
                    {route.origin} → {route.destination}
                    {route.id === primary.route.id ? " · rota de referência" : ""}
                  </td>
                  <td>{formatMoney(route.fareMinor, currency)}</td>
                  <td>{formatCost(quote.baggageMinor, currency)}</td>
                  <td>{formatCost(quote.transferMinor, currency)}</td>
                  <td>{formatCost(quote.lodgingMinor, currency)}</td>
                  <td>{formatCost(quote.feesMinor, currency)}</td>
                  <td>{formatCost(total, currency)}</td>
                  <td>{comparison ? comparison.summary : "Referência desta comparação."}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {indicative.length > 0 ? <p className="notice">Há preço indicativo nesta consulta. Ele não entra nesta conta de oferta atual.</p> : null}
    </section>
  );
}
