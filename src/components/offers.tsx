import type { Itinerary, PriceObservation, FlightSegment } from "@prisma/client";
import { formatBaggage } from "../domain/baggage";
import { formatCivilDate, formatConsultation } from "../domain/dates";
import { formatDuration, offerFreshness, passengerLabel, priceKindLabel, stopsLabel } from "../domain/labels";
import { formatMoney } from "../domain/money";
import type { Segment } from "../domain/provider";

type Row = PriceObservation & { itinerary: Itinerary & { segments: FlightSegment[] } };

function segmentsOf(row: Row): Segment[] {
  return [...row.itinerary.segments]
    .sort((left, right) => left.sequence - right.sequence)
    .map((segment) => ({
      origin: segment.origin,
      destination: segment.destination,
      airline: segment.airline,
      airlineName: segment.airlineName,
      flightNumber: segment.flightNumber,
      departLocal: segment.departLocal,
      arriveLocal: segment.arriveLocal,
    }));
}

export function OfferList({ rows, now }: { rows: Row[]; now: Date }) {
  if (rows.length === 0) return null;
  const currencies = [...new Set(rows.map((row) => row.currency))];
  return (
    <div className="stack">
      {currencies.map((currency) => (
        <section key={currency} className="stack">
          <h2>Ofertas em {currency}</h2>
          <p className="muted">O valor e a moeda gravados são os originais da oferta. Moedas diferentes não são somadas.</p>
          <div className="offer-list">
            {rows
              .filter((row) => row.currency === currency)
              .sort((left, right) => left.totalAmountMinor - right.totalAmountMinor)
              .map((row) => {
                const freshness = offerFreshness(row.offerExpiresAt, now);
                const baggage = formatBaggage(row);
                return (
                  <article
                    key={row.id}
                    className="offer"
                    data-price-kind={row.priceKind}
                    data-currency={row.currency}
                    data-amount={row.totalAmountMinor}
                    data-adults={row.adults}
                    data-baggage={baggage}
                  >
                    <div className="offer-top">
                      <p className="price">{formatMoney(row.totalAmountMinor, row.currency)}</p>
                      <span className={row.priceKind === "DEMONSTRATION" ? "badge badge-demo" : "badge"}>
                        {priceKindLabel(row.priceKind)}
                      </span>
                    </div>
                    <p>
                      Preço para {passengerLabel(row.adults, row.childAges.length)}. Ida {formatCivilDate(row.departDate.toISOString().slice(0, 10))}, volta{" "}
                      {formatCivilDate(row.returnDate.toISOString().slice(0, 10))}.
                    </p>
                    <p>
                      {row.origin} → {row.destination} · {stopsLabel(row.stops)} · {formatDuration(row.itinerary.durationMinutes)}
                    </p>
                    <p>Bagagem: {baggage}</p>
                    <p>
                      <time dateTime={row.sourceCollectedAt.toISOString()}>{formatConsultation(row.sourceCollectedAt)}</time>
                      {row.fromCache ? " · reutilizado do cache, com a data da consulta original" : ""}
                    </p>
                    {row.priceKind === "DEMONSTRATION" ? <p className="muted">Não é uma tarifa ao vivo.</p> : null}
                    {freshness === "expirada" ? (
                      <p className="notice notice-warn">Oferta expirada. O valor continua no histórico, mas não é uma oferta vigente.</p>
                    ) : null}
                    <ol className="segments">
                      {segmentsOf(row).map((segment) => (
                        <li key={`${segment.flightNumber}-${segment.departLocal}`}>
                          {segment.airlineName} {segment.flightNumber}: {segment.origin} {segment.departLocal.replace("T", " ")} → {segment.destination}{" "}
                          {segment.arriveLocal.replace("T", " ")}
                        </li>
                      ))}
                    </ol>
                    {row.providerLink ? <a href={row.providerLink}>Detalhe da oferta simulada</a> : null}
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
