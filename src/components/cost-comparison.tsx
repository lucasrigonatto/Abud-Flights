import { formatMoney } from "../domain/money";

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
  costs: unknown[];
  primaryOrigin?: string;
  primaryDestination?: string;
};

export function CostComparison({ offers, seed }: { offers: CostOffer[]; seed?: CostSeed }) {
  const current = offers.filter((offer) => offer.priceKind !== "LIVE_INDICATIVE");
  const indicative = offers.filter((offer) => offer.priceKind === "LIVE_INDICATIVE");
  const currency = current[0]?.currency ?? offers[0]?.currency ?? "BRL";
  const grouped = new Map<string, CostOffer>();
  for (const offer of current.filter((item) => item.currency === currency)) {
    const key = `${offer.origin}|${offer.destination}`;
    const existing = grouped.get(key);
    if (!existing || offer.fareMinor < existing.fareMinor) grouped.set(key, offer);
  }
  const routes = [...grouped.values()];

  if (routes.length === 0) {
    return (
      <section className="card stack">
        <h2>Tarifas por rota</h2>
        <p className="muted">Ainda não há oferta atual para comparar a tarifa de cada rota.</p>
        {indicative.length > 0 ? <p className="notice">Preço indicativo. Não é uma oferta atual.</p> : null}
      </section>
    );
  }

  const reference =
    routes.find((route) => route.origin === seed?.primaryOrigin && route.destination === seed?.primaryDestination) ?? routes[0];

  return (
    <section className="card stack" id="custo-alternativo">
      <h2>Tarifas por rota</h2>
      <p className="muted">Cada linha é a menor tarifa daquela rota nesta consulta. A comparação é só o valor da passagem.</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rota</th>
              <th>Tarifa</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.id}>
                <td>
                  {route.origin} → {route.destination}
                  {route.id === reference.id ? " · rota de referência" : ""}
                </td>
                <td>{formatMoney(route.fareMinor, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {indicative.length > 0 ? <p className="notice">Há preço indicativo nesta consulta. Ele não entra nesta tabela de oferta atual.</p> : null}
    </section>
  );
}
