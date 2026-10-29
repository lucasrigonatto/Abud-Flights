import type { FlightSegment, Itinerary, PriceObservation } from "@prisma/client";
import { formatBaggage } from "../domain/baggage";
import { formatCivilDate, formatConsultation } from "../domain/dates";
import { formatDuration, offerFreshness, passengerLabel, priceKindLabel, stopsLabel } from "../domain/labels";
import { formatMoney } from "../domain/money";
import type { AirportRecord } from "../lib/airports";
import { OfferBoard, type OfferCard } from "./offer-board";

type Row = PriceObservation & { itinerary: Itinerary & { segments: FlightSegment[] } };

function toCard(row: Row, now: Date): OfferCard {
  const segments = [...row.itinerary.segments]
    .sort((left, right) => left.sequence - right.sequence)
    .map((segment) => ({
      origin: segment.origin,
      destination: segment.destination,
      airlineName: segment.airlineName,
      flightNumber: segment.flightNumber,
      departLocal: segment.departLocal,
      arriveLocal: segment.arriveLocal,
    }));
  return {
    id: row.id,
    priceKind: row.priceKind,
    kindLabel: priceKindLabel(row.priceKind),
    priceLabel: formatMoney(row.totalAmountMinor, row.currency),
    currency: row.currency,
    totalAmountMinor: row.totalAmountMinor,
    adults: row.adults,
    baggage: formatBaggage(row),
    passengerText: passengerLabel(row.adults, row.childAges.length),
    departDate: formatCivilDate(row.departDate.toISOString().slice(0, 10)),
    returnDate: formatCivilDate(row.returnDate.toISOString().slice(0, 10)),
    origin: row.origin,
    destination: row.destination,
    routeText: `${row.origin} → ${row.destination} · ${stopsLabel(row.stops)} · ${formatDuration(row.itinerary.durationMinutes)}`,
    consultation: formatConsultation(row.sourceCollectedAt),
    consultationIso: row.sourceCollectedAt.toISOString(),
    fromCache: row.fromCache,
    expired: offerFreshness(row.offerExpiresAt, now) === "expirada",
    demonstration: row.priceKind === "DEMONSTRATION",
    providerLink: row.providerLink,
    segments,
  };
}

export function OfferList({
  rows,
  now,
  airports,
  route,
}: {
  rows: Row[];
  now: Date;
  airports: AirportRecord[];
  route?: { origins: string[]; destinations: string[] };
}) {
  if (rows.length === 0 && !route) return null;
  return <OfferBoard cards={rows.map((row) => toCard(row, now))} airports={airports} route={route} />;
}
