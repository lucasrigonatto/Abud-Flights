import type { FlightSegment, Itinerary, PriceObservation } from "@prisma/client";
import { formatBaggage } from "../domain/baggage";
import { formatCivilDate, formatConsultation, isoFromUtcDate } from "../domain/dates";
import { formatDuration, offerFreshness, passengerLabel, priceKindLabel, stopsLabel } from "../domain/labels";
import { formatMoney } from "../domain/money";
import type { AirportCost } from "../domain/trip-cost";
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
    passengerText: passengerLabel(row.adults, row.childAges.length > 0 ? row.childAges.length : row.hasChildren),
    departDate: formatCivilDate(isoFromUtcDate(row.departDate)),
    departIso: isoFromUtcDate(row.departDate),
    returnDate: row.returnDate ? formatCivilDate(isoFromUtcDate(row.returnDate)) : null,
    returnIso: isoFromUtcDate(row.returnDate),
    origin: row.origin,
    destination: row.destination,
    routeText: `${row.origin} → ${row.destination} · ${stopsLabel(row.stops)} · ${formatDuration(row.itinerary.durationMinutes)}`,
    consultation: formatConsultation(row.sourceCollectedAt),
    consultationIso: row.sourceCollectedAt.toISOString(),
    fromCache: row.fromCache,
    expired: offerFreshness(row.offerExpiresAt, now) === "expirada",
    demonstration: row.priceKind === "DEMONSTRATION",
    providerLink: row.providerLink,
    durationMinutes: row.itinerary.durationMinutes,
    baggageKnown: row.baggageKnown,
    baggageIncluded: row.baggageIncluded,
    checkedBags: row.checkedBags,
    segments,
  };
}

export function OfferList({
  rows,
  now,
  route,
  costSeed,
}: {
  rows: Row[];
  now: Date;
  route?: { origins: string[]; destinations: string[] };
  costSeed?: {
    requiredBags: number | null;
    extraBagAmountMinor: number | null;
    costs: AirportCost[];
    primaryOrigin?: string;
    primaryDestination?: string;
  };
}) {
  if (rows.length === 0 && !route) return null;
  return <OfferBoard cards={rows.map((row) => toCard(row, now))} route={route} costSeed={costSeed} />;
}
