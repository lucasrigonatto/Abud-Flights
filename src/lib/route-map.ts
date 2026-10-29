import { greatCircle, haversineKm } from "./geo";
import type { AirportRecord } from "./airports";

export const NEARBY_RADIUS_KM = 900;
export const NEARBY_LIMIT = 5;

export type MarkerRole =
  | "origin"
  | "destination"
  | "alternate-origin"
  | "alternate-destination"
  | "nearby-origin"
  | "nearby-destination"
  | "connection";

export type RouteMarker = {
  iata: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  role: MarkerRole;
  distanceKm: number | null;
  onPath: boolean;
};

export type RouteLine = {
  id: string;
  kind: "primary" | "alternate" | "itinerary";
  positions: Array<[number, number]>;
};

export type RouteMapModel = {
  summary: string;
  connections: string[];
  markers: RouteMarker[];
  lines: RouteLine[];
};

export type RouteSegment = {
  origin: string;
  destination: string;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function resolveAirports(codes: string[], byIata: Map<string, AirportRecord>): AirportRecord[] {
  const seen = new Set<string>();
  const resolved: AirportRecord[] = [];
  for (const code of codes) {
    const airport = byIata.get(normalizeCode(code));
    if (!airport || seen.has(airport.iata)) continue;
    seen.add(airport.iata);
    resolved.push(airport);
  }
  return resolved;
}

export function segmentChain(segments: RouteSegment[]): string[] {
  if (segments.length === 0) return [];
  const chain = [normalizeCode(segments[0].origin)];
  for (const segment of segments) {
    const origin = normalizeCode(segment.origin);
    const destination = normalizeCode(segment.destination);
    if (chain[chain.length - 1] !== origin) chain.push(origin);
    chain.push(destination);
  }
  return chain;
}

export function connectionAirports(segments: RouteSegment[], endpoints: string[]): string[] {
  const ends = new Set(endpoints.map(normalizeCode));
  const chain = segmentChain(segments);
  const connections: string[] = [];
  for (const code of chain.slice(1, -1)) {
    if (ends.has(code) || connections.includes(code)) continue;
    connections.push(code);
  }
  return connections;
}

export function nearbyAirports(
  airports: AirportRecord[],
  anchor: AirportRecord,
  exclude: string[],
  radiusKm = NEARBY_RADIUS_KM,
  limit = NEARBY_LIMIT,
): Array<{ airport: AirportRecord; distanceKm: number }> {
  const blocked = new Set(exclude.map(normalizeCode));
  return airports
    .filter((airport) => airport.iata !== anchor.iata && !blocked.has(airport.iata))
    .map((airport) => ({ airport, distanceKm: Math.round(haversineKm(anchor, airport)) }))
    .filter((item) => item.distanceKm <= radiusKm)
    .sort((left, right) => left.distanceKm - right.distanceKm || left.airport.iata.localeCompare(right.airport.iata))
    .slice(0, limit);
}

export function toggleAlternate(current: [string, string], iata: string): [string, string] {
  const code = normalizeCode(iata);
  if (!/^[A-Z]{3}$/.test(code)) return current;
  if (current[0] === code) return ["", current[1]];
  if (current[1] === code) return [current[0], ""];
  if (!current[0]) return [code, current[1]];
  if (!current[1]) return [current[0], code];
  return [current[0], code];
}

function lineBetween(from: AirportRecord, to: AirportRecord, id: string, kind: RouteLine["kind"]): RouteLine {
  return { id, kind, positions: greatCircle(from, to) };
}

function marker(airport: AirportRecord, role: MarkerRole, distanceKm: number | null, onPath: boolean): RouteMarker {
  return {
    iata: airport.iata,
    name: airport.name,
    city: airport.city,
    latitude: airport.latitude,
    longitude: airport.longitude,
    role,
    distanceKm,
    onPath,
  };
}

export function buildRouteMapModel(input: {
  airports: AirportRecord[];
  origins: string[];
  destinations: string[];
  segments?: RouteSegment[];
  showNearby?: boolean;
}): RouteMapModel {
  const byIata = new Map(input.airports.map((airport) => [airport.iata, airport]));
  const origins = resolveAirports(input.origins, byIata);
  const destinations = resolveAirports(input.destinations, byIata);
  const segments = (input.segments ?? []).map((segment) => ({
    origin: normalizeCode(segment.origin),
    destination: normalizeCode(segment.destination),
  }));
  const chain = segmentChain(segments);
  const endpoints = [...origins.map((airport) => airport.iata), ...destinations.map((airport) => airport.iata)];
  const connections = connectionAirports(segments, endpoints);
  const markers: RouteMarker[] = [];

  origins.forEach((airport, index) => {
    markers.push(marker(airport, index === 0 ? "origin" : "alternate-origin", null, true));
  });
  destinations.forEach((airport, index) => {
    markers.push(marker(airport, index === 0 ? "destination" : "alternate-destination", null, true));
  });

  for (const code of connections) {
    const airport = byIata.get(code);
    if (!airport || markers.some((item) => item.iata === code)) continue;
    markers.push(marker(airport, "connection", null, true));
  }

  if (input.showNearby) {
    const chosen = markers.map((item) => item.iata);
    if (origins[0]) {
      for (const nearby of nearbyAirports(input.airports, origins[0], chosen)) {
        markers.push(marker(nearby.airport, "nearby-origin", nearby.distanceKm, false));
      }
    }
    const chosenAfterOrigin = markers.map((item) => item.iata);
    if (destinations[0]) {
      for (const nearby of nearbyAirports(input.airports, destinations[0], chosenAfterOrigin)) {
        markers.push(marker(nearby.airport, "nearby-destination", nearby.distanceKm, false));
      }
    }
  }

  const lines: RouteLine[] = [];
  if (segments.length > 0) {
    const positions: Array<[number, number]> = [];
    for (const segment of segments) {
      const from = byIata.get(segment.origin);
      const to = byIata.get(segment.destination);
      if (!from || !to) continue;
      const arc = greatCircle(from, to);
      positions.push(...(positions.length > 0 ? arc.slice(1) : arc));
    }
    if (positions.length > 0) lines.push({ id: "itinerary", kind: "itinerary", positions });
  } else if (origins[0] && destinations[0]) {
    lines.push(lineBetween(origins[0], destinations[0], "primary", "primary"));
    for (const origin of origins.slice(1)) {
      lines.push(lineBetween(origin, destinations[0], `alt-origin-${origin.iata}`, "alternate"));
    }
    for (const destination of destinations.slice(1)) {
      lines.push(lineBetween(origins[0], destination, `alt-destination-${destination.iata}`, "alternate"));
    }
  }

  const summary = chain.length > 1 ? chain.join(" → ") : origins[0] && destinations[0] ? `${origins[0].iata} → ${destinations[0].iata}` : "";

  return { summary, connections, markers, lines };
}

export function markerRoleLabel(role: MarkerRole): string {
  if (role === "origin") return "Origem";
  if (role === "destination") return "Destino";
  if (role === "alternate-origin") return "Origem alternativa";
  if (role === "alternate-destination") return "Destino alternativo";
  if (role === "nearby-origin") return "Opção próxima da origem";
  if (role === "nearby-destination") return "Opção próxima do destino";
  return "Conexão";
}
