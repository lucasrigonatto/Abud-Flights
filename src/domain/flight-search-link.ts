const IATA = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FLIGHT = /^([A-Z][A-Z0-9])(\d{1,4})$/;

export type FlightLinkSegment = {
  origin: string;
  destination: string;
  departLocal: string;
  flightNumber: string;
};

type EncodedSegment = {
  origin: string;
  destination: string;
  date: string;
  airline: string;
  number: string;
};

function varint(value: number): number[] {
  const bytes: number[] = [];
  let rest = value;
  while (rest > 127) {
    bytes.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 128);
  }
  bytes.push(rest);
  return bytes;
}

function fieldVarint(field: number, value: number): number[] {
  return [...varint((field << 3) | 0), ...varint(value)];
}

function fieldBytes(field: number, payload: number[]): number[] {
  return [...varint((field << 3) | 2), ...varint(payload.length), ...payload];
}

function fieldString(field: number, value: string): number[] {
  return fieldBytes(field, [...Buffer.from(value)]);
}

function airport(code: string): number[] {
  return [...fieldVarint(1, 1), ...fieldString(2, code)];
}

function segmentMessage(segment: EncodedSegment): number[] {
  const body = [
    ...fieldString(1, segment.origin),
    ...fieldString(2, segment.date),
    ...fieldString(3, segment.destination),
    ...fieldString(5, segment.airline),
    ...fieldString(6, segment.number),
  ];
  return fieldBytes(4, body);
}

function legMessage(date: string, segments: EncodedSegment[], origin: string, destination: string): number[] {
  const body = [
    ...fieldString(2, date),
    ...segments.flatMap(segmentMessage),
    ...fieldBytes(13, airport(origin)),
    ...fieldBytes(14, airport(destination)),
  ];
  return fieldBytes(3, body);
}

const UNBOUNDED = [0x08, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01];

function bookingToken(legs: Array<{ date: string; origin: string; destination: string; segments: EncodedSegment[] }>, adults: number): string {
  const roundTrip = legs.length > 1;
  const body = [
    ...fieldVarint(1, 28),
    ...fieldVarint(2, roundTrip ? 2 : 1),
    ...legs.flatMap((leg) => legMessage(leg.date, leg.segments, leg.origin, leg.destination)),
    ...fieldVarint(8, adults),
    ...fieldVarint(9, 1),
    ...fieldVarint(14, 1),
    ...fieldBytes(16, UNBOUNDED),
    ...fieldVarint(19, 1),
  ];
  return Buffer.from(body).toString("base64url");
}

function searchToken(origin: string, destination: string, departDate: string, returnDate: string | null): string {
  const leg = (date: string, from: string, to: string) => fieldBytes(3, [...fieldString(2, date), ...fieldBytes(13, airport(from)), ...fieldBytes(14, airport(to))]);
  const roundTrip = Boolean(returnDate);
  const body = [
    ...fieldVarint(1, 28),
    ...fieldVarint(2, roundTrip ? 2 : 1),
    ...leg(departDate, origin, destination),
    ...(returnDate ? leg(returnDate, destination, origin) : []),
    ...fieldVarint(8, 1),
    ...fieldVarint(9, 1),
    ...fieldVarint(14, 1),
    ...fieldVarint(19, 1),
  ];
  return Buffer.from(body).toString("base64url");
}

function dateOf(local: string): string | null {
  const date = local.slice(0, 10);
  return ISO_DATE.test(date) ? date : null;
}

function encodeSegment(segment: FlightLinkSegment): EncodedSegment | null {
  const origin = segment.origin.trim().toUpperCase();
  const destination = segment.destination.trim().toUpperCase();
  const date = dateOf(segment.departLocal);
  const flight = segment.flightNumber.trim().toUpperCase().match(FLIGHT);
  if (!IATA.test(origin) || !IATA.test(destination) || !date || !flight) return null;
  return { origin, destination, date, airline: flight[1], number: flight[2] };
}

function legsFromSegments(segments: FlightLinkSegment[], returnDate: string | null): Array<{ date: string; origin: string; destination: string; segments: EncodedSegment[] }> | null {
  const encoded = segments.map(encodeSegment);
  if (encoded.length === 0 || encoded.some((segment) => segment === null)) return null;
  const ready = encoded as EncodedSegment[];
  const groups: EncodedSegment[][] = [];
  if (!returnDate) groups.push(ready);
  else {
    const outbound = ready.filter((segment) => segment.date < returnDate);
    const inbound = ready.filter((segment) => segment.date >= returnDate);
    if (outbound.length === 0 || inbound.length === 0) return null;
    groups.push(outbound, inbound);
  }
  return groups.map((group) => ({
    date: group[0].date,
    origin: group[0].origin,
    destination: group[group.length - 1].destination,
    segments: group,
  }));
}

export function googleFlightsUrl(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  currency: string;
  adults?: number;
  segments?: FlightLinkSegment[];
}): string | null {
  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();
  const departDate = input.departDate.trim();
  const returnDate = input.returnDate?.trim() || null;
  const currency = input.currency.trim().toUpperCase();
  if (!IATA.test(origin) || !IATA.test(destination) || !ISO_DATE.test(departDate)) return null;
  if (returnDate && !ISO_DATE.test(returnDate)) return null;
  if (!/^[A-Z]{3}$/.test(currency)) return null;

  const adults = input.adults && input.adults >= 1 && input.adults <= 9 ? input.adults : 1;
  const legs = input.segments ? legsFromSegments(input.segments, returnDate) : null;
  const token = legs ? bookingToken(legs, adults) : searchToken(origin, destination, departDate, returnDate);
  const page = legs ? "booking" : "search";
  return `https://www.google.com/travel/flights/${page}?tfs=${token}&hl=pt-BR&curr=${currency}`;
}
