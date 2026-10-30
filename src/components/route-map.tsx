"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { markerRoleLabel, type MarkerRole, type RouteMapModel, type RouteMarker } from "../lib/route-map";

type LeafletLib = typeof import("leaflet");

const LINE_STYLE: Record<RouteMapModel["lines"][number]["kind"], { color: string; weight: number; opacity: number; dashArray?: string }> = {
  primary: { color: "#0c6e66", weight: 4, opacity: 0.95 },
  alternate: { color: "#b86e00", weight: 3, opacity: 0.95, dashArray: "2 7" },
  itinerary: { color: "#17212b", weight: 4.5, opacity: 0.95 },
};

function pinTone(role: MarkerRole): string {
  if (role === "origin") return "pin-origin";
  if (role === "destination") return "pin-destination";
  if (role === "connection") return "pin-connection";
  if (role.startsWith("alternate")) return "pin-alternate";
  return "pin-nearby";
}

function labeledPin(role: MarkerRole, iata: string): { html: string; iconSize: [number, number]; iconAnchor: [number, number]; direction: "left" | "right" | "top" | "bottom" } {
  const pin = `<span class="pin ${pinTone(role)}">${iata}</span>`;
  if (role === "destination") {
    return { html: `<span class="pin-row">${pin}</span>`, iconSize: [54, 24], iconAnchor: [-10, 12], direction: "right" };
  }
  if (role === "alternate-destination" || role === "connection") {
    return { html: `<span class="pin-stack">${pin}</span>`, iconSize: [54, 24], iconAnchor: [27, 36], direction: "top" };
  }
  if (role === "alternate-origin") {
    return { html: `<span class="pin-stack">${pin}</span>`, iconSize: [54, 24], iconAnchor: [27, -8], direction: "bottom" };
  }
  return { html: `<span class="pin-row">${pin}</span>`, iconSize: [54, 24], iconAnchor: [64, 12], direction: "left" };
}

function resolveLeaflet(imported: LeafletLib & { default?: LeafletLib }): LeafletLib {
  if (typeof imported.map === "function") return imported;
  if (imported.default && typeof imported.default.map === "function") return imported.default;
  return imported;
}

export function RouteMap({ model, onPick }: { model: RouteMapModel; onPick?: (marker: RouteMarker) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<LeafletLib | null>(null);
  const pickRef = useRef(onPick);
  const [ready, setReady] = useState(false);
  pickRef.current = onPick;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let disposed = false;
    let map: LeafletMap | null = null;

    void import("leaflet").then((imported) => {
      if (disposed || !frameRef.current) return;
      const L = resolveLeaflet(imported);
      leafletRef.current = L;
      map = L.map(frameRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      }).setView([-14, -40], 3);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    });

    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      layerRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const group = layerRef.current;
    if (!ready || !L || !map || !group) return;
    group.clearLayers();

    const drawOrder = { alternate: 0, primary: 1, itinerary: 2 };
    const lines = [...model.lines].sort((left, right) => drawOrder[left.kind] - drawOrder[right.kind]);
    for (const line of lines) {
      L.polyline(line.positions, LINE_STYLE[line.kind]).addTo(group);
    }

    const points: Array<[number, number]> = [];
    for (const item of model.markers) {
      const position: [number, number] = [item.latitude, item.longitude];
      points.push(position);
      const nearby = item.role.startsWith("nearby");
      const quiet = nearby || !item.onPath;
      const label = labeledPin(item.role, item.iata);
      const marker = L.marker(position, {
        icon: quiet
          ? L.divIcon({
              className: "route-pin",
              html: `<span class="dot ${item.role.includes("destination") ? "dot-destination" : "dot-origin"}"></span>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })
          : L.divIcon({
              className: "route-pin",
              html: label.html,
              iconSize: label.iconSize,
              iconAnchor: label.iconAnchor,
            }),
        keyboard: true,
        title: `${item.iata}, ${item.city}. ${markerRoleLabel(item.role)}`,
        zIndexOffset: item.onPath ? 400 : 0,
      }).addTo(group);
      marker.bindTooltip(`${item.iata} · ${item.city}`, {
        direction: quiet ? "top" : label.direction,
        opacity: 1,
        permanent: false,
      });
      marker.on("click", () => {
        if (item.role.startsWith("nearby") || item.role.startsWith("alternate")) pickRef.current?.(item);
      });
    }

    const fit = () => {
      map.invalidateSize();
      if (points.length === 1) map.setView(points[0], 6);
      else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [52, 72], maxZoom: 6 });
    };
    fit();
    const timer = window.setTimeout(fit, 200);
    return () => window.clearTimeout(timer);
  }, [model, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const frame = frameRef.current;
    if (!map || !frame) return;
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(frame);
    return () => observer.disconnect();
  }, [ready]);

  const choosable = model.markers.filter((marker) => marker.role !== "origin" && marker.role !== "destination");

  return (
    <div className="map-shell">
      {model.summary ? <p className="map-summary">{model.summary}</p> : <p className="map-summary">Rota ainda sem origem e destino</p>}
      {model.connections.length > 0 ? <p className="muted">Conexão: {model.connections.join(", ")}</p> : null}
      <div ref={frameRef} className="map-canvas" role="application" aria-label="Mapa da rota selecionada" />
      <ul className="map-legend">
        <li><span className="pin pin-origin">GYN</span> Origem</li>
        <li><span className="pin pin-destination">LIS</span> Destino</li>
        <li><span className="pin pin-alternate">ALT</span> Alternativa</li>
        <li><span className="pin pin-connection">HUB</span> Conexão</li>
        <li><span className="pin pin-nearby">OPC</span> Opção próxima</li>
      </ul>
      {choosable.length > 0 ? (
        <ul className="airport-picks">
          {choosable.map((marker) => {
            const label = `${marker.iata}, ${marker.city}. ${markerRoleLabel(marker.role)}${marker.distanceKm !== null ? `, ${marker.distanceKm} km` : ""}`;
            const pressed = marker.role.startsWith("alternate");
            return (
              <li key={`${marker.role}-${marker.iata}`}>
                {onPick && (pressed || marker.role.startsWith("nearby")) ? (
                  <button type="button" className="airport-pick" aria-pressed={pressed} onClick={() => onPick(marker)}>
                    <strong>{marker.iata}</strong>
                    <span>{marker.city}</span>
                    <span>
                      {markerRoleLabel(marker.role)}
                      {marker.distanceKm !== null ? ` · ${marker.distanceKm} km` : ""}
                    </span>
                  </button>
                ) : (
                  <span className="airport-pick">{label}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
