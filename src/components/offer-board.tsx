"use client";

import { useMemo, useState } from "react";
import { buildRouteMapModel } from "../lib/route-map";
import type { AirportRecord } from "../lib/airports";
import type { PriceKind } from "../domain/provider";
import type { AirportCost } from "../domain/trip-cost";
import { describeTripLink } from "../domain/trip-link";
import { CostComparison, type CostOffer } from "./cost-comparison";
import { RouteMap } from "./route-map";

export type OfferCard = {
  id: string;
  priceKind: string;
  kindLabel: string;
  priceLabel: string;
  currency: string;
  totalAmountMinor: number;
  adults: number;
  baggage: string;
  passengerText: string;
  departDate: string;
  returnDate: string;
  origin: string;
  destination: string;
  routeText: string;
  consultation: string;
  consultationIso: string;
  fromCache: boolean;
  expired: boolean;
  demonstration: boolean;
  providerLink: string | null;
  durationMinutes: number;
  baggageKnown: boolean;
  baggageIncluded: boolean | null;
  checkedBags: number | null;
  segments: Array<{
    origin: string;
    destination: string;
    airlineName: string;
    flightNumber: string;
    departLocal: string;
    arriveLocal: string;
  }>;
};

function TripLink({ link, priceKind }: { link: string | null; priceKind: string }) {
  const trip = describeTripLink(link, priceKind as PriceKind);
  if (trip.kind === "unavailable") return <p className="muted">{trip.note}</p>;
  return (
    <p>
      <a href={trip.href} target={trip.external ? "_blank" : undefined} rel={trip.external ? "noopener noreferrer" : undefined}>
        {trip.label}
      </a>
      <span className="muted"> {trip.note}</span>
    </p>
  );
}

export function OfferBoard({
  cards,
  airports,
  route,
  costSeed,
}: {
  cards: OfferCard[];
  airports: AirportRecord[];
  route?: { origins: string[]; destinations: string[] };
  costSeed?: {
    requiredBags: number | null;
    extraBagAmountMinor: number | null;
    costs: AirportCost[];
    primaryOrigin?: string;
    primaryDestination?: string;
  };
}) {
  const currencies = useMemo(() => [...new Set(cards.map((card) => card.currency))], [cards]);
  const defaultId = useMemo(() => {
    const currency = currencies[0];
    return cards
      .filter((card) => card.currency === currency)
      .sort((left, right) => left.totalAmountMinor - right.totalAmountMinor)[0]?.id ?? "";
  }, [cards, currencies]);
  const [selectedId, setSelectedId] = useState(defaultId);
  const selected = cards.find((card) => card.id === selectedId) ?? cards.find((card) => card.id === defaultId) ?? null;

  const model = useMemo(() => {
    const extraOrigins = cards.map((card) => card.origin);
    const extraDestinations = cards.map((card) => card.destination);
    const origins = route?.origins ?? (selected ? [selected.origin, ...extraOrigins] : extraOrigins);
    const destinations = route?.destinations ?? (selected ? [selected.destination, ...extraDestinations] : extraDestinations);
    return buildRouteMapModel({
      airports,
      origins,
      destinations,
      segments: selected?.segments ?? [],
      showNearby: false,
    });
  }, [airports, cards, route, selected]);

  return (
    <div className="stack">
      <section className="card stack">
        <h2>Rota no mapa</h2>
        <p className="muted">
          {selected
            ? "A oferta selecionada desenha a rota, com a conexão quando ela existe. Origem, destino e alternativas continuam marcados."
            : "A rota escolhida aparece aqui. Selecione uma oferta para ver o caminho e as conexões."}
        </p>
        <RouteMap model={model} />
      </section>
      <CostComparison
        offers={cards.map(
          (card): CostOffer => ({
            id: card.id,
            origin: card.origin,
            destination: card.destination,
            fareMinor: card.totalAmountMinor,
            currency: card.currency,
            durationMinutes: card.durationMinutes,
            baggageKnown: card.baggageKnown,
            baggageIncluded: card.baggageIncluded,
            checkedBags: card.checkedBags,
            priceKind: card.priceKind,
          }),
        )}
        seed={costSeed ?? { requiredBags: null, extraBagAmountMinor: null, costs: [], primaryOrigin: route?.origins[0], primaryDestination: route?.destinations[0] }}
      />
      {currencies.map((currency) => (
        <section key={currency} className="stack">
          <h2>Ofertas em {currency}</h2>
          <p className="muted">O valor e a moeda gravados são os originais da oferta. Moedas diferentes não são somadas.</p>
          <div className="offer-list">
            {cards
              .filter((card) => card.currency === currency)
              .sort((left, right) => left.totalAmountMinor - right.totalAmountMinor)
              .map((card) => {
                const active = card.id === selected?.id;
                return (
                  <article
                    key={card.id}
                    className={active ? "offer is-selected" : "offer"}
                    data-price-kind={card.priceKind}
                    data-currency={card.currency}
                    data-amount={card.totalAmountMinor}
                    data-adults={card.adults}
                    data-baggage={card.baggage}
                  >
                    <div className="offer-top">
                      <p className="price">{card.priceLabel}</p>
                      <span className={card.demonstration ? "badge badge-demo" : "badge"}>{card.kindLabel}</span>
                    </div>
                    <p>
                      Preço para {card.passengerText}. Ida {card.departDate}, volta {card.returnDate}.
                    </p>
                    <p>{card.routeText}</p>
                    <p>Bagagem: {card.baggage}</p>
                    <p>
                      <time dateTime={card.consultationIso}>{card.consultation}</time>
                      {card.fromCache ? " · reutilizado do cache, com a data da consulta original" : ""}
                    </p>
                    {card.demonstration ? <p className="muted">Não é uma tarifa ao vivo.</p> : null}
                    {card.expired ? (
                      <p className="notice notice-warn">Oferta expirada. O valor continua no histórico, mas não é uma oferta vigente.</p>
                    ) : null}
                    <ol className="segments">
                      {card.segments.map((segment) => (
                        <li key={`${segment.flightNumber}-${segment.departLocal}`}>
                          {segment.airlineName} {segment.flightNumber}: {segment.origin} {segment.departLocal.replace("T", " ")} → {segment.destination}{" "}
                          {segment.arriveLocal.replace("T", " ")}
                        </li>
                      ))}
                    </ol>
                    <button type="button" className={active ? "btn" : "btn btn-secondary"} aria-pressed={active} onClick={() => setSelectedId(card.id)}>
                      {active ? "Rota em destaque no mapa" : "Ver esta rota no mapa"}
                    </button>
                    <TripLink link={card.providerLink} priceKind={card.priceKind} />
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
