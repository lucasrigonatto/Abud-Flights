import type { PriceObservation } from "@prisma/client";
import { formatBaggage } from "../domain/baggage";
import { formatCivilDate, formatConsultation } from "../domain/dates";
import { classifyHistory, comparabilityKey, groupComparable, type ObservationView } from "../domain/history";
import { formatMoney } from "../domain/money";
import { passengerLabel, priceKindLabel } from "../domain/labels";

function toView(row: PriceObservation): ObservationView {
  return {
    filtersVersion: row.filtersVersion,
    origin: row.origin,
    destination: row.destination,
    departDate: row.departDate.toISOString().slice(0, 10),
    returnDate: row.returnDate.toISOString().slice(0, 10),
    cabin: row.cabin,
    adults: row.adults,
    childAges: row.childAges,
    currency: row.currency,
    market: row.market,
    priceKind: row.priceKind,
    baggageKnown: row.baggageKnown,
    baggageIncluded: row.baggageIncluded,
    checkedBags: row.checkedBags,
    totalAmountMinor: row.totalAmountMinor,
    collectedAt: row.sourceCollectedAt.toISOString(),
    sourceCollectedAt: row.sourceCollectedAt.toISOString(),
  };
}

export function HistoryPanel({
  rows,
  filtersVersion,
  title,
}: {
  rows: PriceObservation[];
  filtersVersion: number;
  title: string;
}) {
  const views = rows.map(toView);
  const groups = groupComparable(views, filtersVersion);
  if (groups.length === 0) {
    const reading = classifyHistory([]);
    return (
      <section className="stack">
        <h2>{title}</h2>
        <p className="reading">{reading.label}</p>
        <p className="muted">Ainda não há observações comparáveis para estes critérios.</p>
      </section>
    );
  }
  return (
    <section className="stack">
      <h2>{title}</h2>
      {groups.map((group) => {
        const sample = group.observations[0];
        return (
          <article key={group.key} className="card stack">
            <p className="reading">{group.reading.label}</p>
            <p className="muted">
              {sample.origin} → {sample.destination} · {passengerLabel(sample.adults, sample.childAges.length)} · bagagem {formatBaggage(sample)} ·{" "}
              {sample.currency} · {priceKindLabel(sample.priceKind)}
            </p>
            <p className="muted">
              Amostra: {group.reading.sampleSize} observações, {group.reading.distinctDays} dias com coleta, {group.reading.distinctDepartures} partidas distintas.
              {group.reading.minAmountMinor !== null ? ` Menor preço: ${formatMoney(group.reading.minAmountMinor, sample.currency)}.` : ""}
              {group.reading.medianAmountMinor !== null ? ` Mediana: ${formatMoney(group.reading.medianAmountMinor, sample.currency)}.` : ""}
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Consulta</th>
                    <th>Ida</th>
                    <th>Volta</th>
                    <th>Preço</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {[...group.observations]
                    .sort((left, right) => right.collectedAt.localeCompare(left.collectedAt))
                    .map((observation, index) => (
                      <tr key={`${observation.sourceCollectedAt}-${observation.departDate}-${observation.totalAmountMinor}-${index}`}>
                        <td>{formatConsultation(new Date(observation.sourceCollectedAt))}</td>
                        <td>{formatCivilDate(observation.departDate)}</td>
                        <td>{formatCivilDate(observation.returnDate)}</td>
                        <td>{formatMoney(observation.totalAmountMinor, observation.currency)}</td>
                        <td>{priceKindLabel(observation.priceKind)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function historyForSearch(runRows: PriceObservation[], allRows: PriceObservation[]): PriceObservation[] {
  const keys = new Set(runRows.map((row) => comparabilityKey(toView(row))));
  return allRows.filter((row) => row.filtersVersion === 0 && keys.has(comparabilityKey(toView(row))));
}
