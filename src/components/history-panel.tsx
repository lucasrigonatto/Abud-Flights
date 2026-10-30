import type { PriceObservation } from "@prisma/client";
import { formatBaggage } from "../domain/baggage";
import { formatCivilDate, formatConsultation } from "../domain/dates";
import {
  chartSegments,
  classifyHistory,
  comparabilityKey,
  dateMatrix,
  groupComparable,
  lowestByCollectionDay,
  type ObservationView,
  type PricePoint,
} from "../domain/history";
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
            <p className={`reading reading-${group.reading.classification}`}>{group.reading.label}</p>
            {sample.priceKind === "LIVE_INDICATIVE" ? <p className="notice">Preço indicativo. Não é uma oferta atual.</p> : null}
            {sample.priceKind === "DEMONSTRATION" ? <p className="muted">Preço de demonstração. Não é uma tarifa ao vivo.</p> : null}
            <PriceChart points={lowestByCollectionDay(group.observations)} currency={sample.currency} />
            <DateMatrix observations={group.observations} currency={sample.currency} />
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

function PriceChart({ points, currency }: { points: PricePoint[]; currency: string }) {
  const width = 640;
  const height = 200;
  const pad = { left: 16, right: 16, top: 16, bottom: 28 };
  if (points.length === 0) {
    return <p className="muted">Não há coleta para o gráfico. Uma lacuna não vira zero.</p>;
  }
  const min = Math.min(...points.map((point) => point.amountMinor));
  const max = Math.max(...points.map((point) => point.amountMinor));
  const span = Math.max(1, max - min);
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const xAt = (index: number) => (points.length === 1 ? pad.left + innerWidth / 2 : pad.left + (index * innerWidth) / (points.length - 1));
  const yAt = (amount: number) => pad.top + ((max - amount) / span) * innerHeight;
  const indexOf = (point: PricePoint) => points.findIndex((item) => item.day === point.day);
  return (
    <figure className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label="Menor preço comparável por dia de coleta">
        {chartSegments(points).map((segment, segmentIndex) => (
          <polyline
            key={`${segment[0]?.day ?? segmentIndex}`}
            className="chart-line"
            points={segment.map((point) => `${xAt(indexOf(point))},${yAt(point.amountMinor)}`).join(" ")}
          />
        ))}
        {points.map((point, index) => (
          <circle key={point.day} className="chart-dot" cx={xAt(index)} cy={yAt(point.amountMinor)} r="4">
            <title>{`${formatCivilDate(point.day)} · ${formatMoney(point.amountMinor, currency)}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="muted">
        Menor preço de {formatMoney(min, currency)} a {formatMoney(max, currency)}. Cada ponto é o menor preço comparável daquele dia de coleta. Dias sem coleta interrompem a linha e não viram zero.
      </figcaption>
    </figure>
  );
}

function DateMatrix({ observations, currency }: { observations: ObservationView[]; currency: string }) {
  const matrix = dateMatrix(observations);
  if (matrix.departures.length === 0) return null;
  return (
    <div className="stack">
      <h3>Ida e volta</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ida \ volta</th>
              {matrix.returns.map((returnDate) => (
                <th key={returnDate}>{formatCivilDate(returnDate)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.departures.map((departDate, rowIndex) => (
              <tr key={departDate}>
                <th>{formatCivilDate(departDate)}</th>
                {matrix.amounts[rowIndex].map((amount, columnIndex) => (
                  <td key={`${departDate}-${matrix.returns[columnIndex]}`} className={amount === null ? "gap" : undefined}>
                    {amount === null ? "lacuna" : formatMoney(amount, currency)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Célula vazia é lacuna de coleta, não preço zero.</p>
    </div>
  );
}

export function historyForSearch(runRows: PriceObservation[], allRows: PriceObservation[]): PriceObservation[] {
  const keys = new Set(runRows.map((row) => comparabilityKey(toView(row))));
  return allRows.filter((row) => row.filtersVersion === 0 && keys.has(comparabilityKey(toView(row))));
}
