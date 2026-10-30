"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionState } from "../app/actions";
import type { AirportRecord } from "../lib/airports";
import { airportLabel } from "../lib/airports";
import { buildRouteMapModel, toggleAlternate, type RouteMarker } from "../lib/route-map";
import type { TripDefaults } from "../lib/trip-defaults";
import { RouteMap } from "./route-map";

export type { TripDefaults };

function GroundCostFields({
  airports,
  saved,
}: {
  airports: string[];
  saved: TripDefaults["groundCosts"];
}) {
  const codes = [...new Set(airports.map(codeValue).filter((code) => code.length === 3))];
  if (codes.length === 0) return null;
  return (
    <div className="stack">
      <p className="muted">
        Custos extras por aeroporto. Em branco fica “não informado” e não vira zero. Informe 0 quando o extra não existe. O total só fecha quando tarifa, bagagem, transfer, hospedagem e taxas são conhecidos.
      </p>
      {codes.map((code) => {
        const current = saved[code] ?? { transfer: "", lodging: "", fees: "", minutes: "" };
        return (
          <div key={code} className="form-grid">
            <label>
              Transfer extra em {code}
              <input name={`transfer_${code}`} defaultValue={current.transfer} inputMode="decimal" placeholder="não informado" />
            </label>
            <label>
              Hospedagem extra em {code}
              <input name={`lodging_${code}`} defaultValue={current.lodging} inputMode="decimal" placeholder="não informado" />
            </label>
            <label>
              Taxas conhecidas em {code}
              <input name={`fees_${code}`} defaultValue={current.fees} inputMode="decimal" placeholder="não informado" />
            </label>
            <label>
              Minutos extras em {code}
              <input name={`minutes_${code}`} defaultValue={current.minutes} inputMode="numeric" placeholder="não informado" />
            </label>
          </div>
        );
      })}
    </div>
  );
}

function codeValue(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
}

export function TripForm({
  action,
  airports,
  requestKey,
  defaults,
  mode,
  submitLabel,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  airports: AirportRecord[];
  requestKey?: string;
  defaults: TripDefaults;
  mode: "search" | "monitor";
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "" });
  const [origin, setOrigin] = useState(defaults.origin);
  const [originAlts, setOriginAlts] = useState<[string, string]>([defaults.originAlt1, defaults.originAlt2]);
  const [destination, setDestination] = useState(defaults.destination);
  const [destinationAlts, setDestinationAlts] = useState<[string, string]>([defaults.destinationAlt1, defaults.destinationAlt2]);

  const model = useMemo(
    () =>
      buildRouteMapModel({
        airports,
        origins: [origin, originAlts[0], originAlts[1]],
        destinations: [destination, destinationAlts[0], destinationAlts[1]],
        showNearby: true,
      }),
    [airports, destination, destinationAlts, origin, originAlts],
  );

  function pick(marker: RouteMarker) {
    if (marker.role === "nearby-origin") {
      if (!origin) setOrigin(marker.iata);
      else setOriginAlts((current) => toggleAlternate(current, marker.iata));
      return;
    }
    if (marker.role === "alternate-origin") {
      setOriginAlts((current) => toggleAlternate(current, marker.iata));
      return;
    }
    if (marker.role === "nearby-destination") {
      if (!destination) setDestination(marker.iata);
      else setDestinationAlts((current) => toggleAlternate(current, marker.iata));
      return;
    }
    if (marker.role === "alternate-destination") {
      setDestinationAlts((current) => toggleAlternate(current, marker.iata));
    }
  }

  return (
    <form action={formAction} className="stack">
      {requestKey ? <input type="hidden" name="requestKey" value={requestKey} /> : null}
      {defaults.monitorId ? <input type="hidden" name="monitorId" value={defaults.monitorId} /> : null}
      {state.error ? <p className="notice notice-danger">{state.error}</p> : null}
      <div className="planner">
        <div className="stack">
          {mode === "monitor" ? (
            <label className="card field-block">
              Nome
              <input name="name" defaultValue={defaults.name} maxLength={80} />
            </label>
          ) : null}
          <fieldset className="card fields">
            <legend>Rota</legend>
            <div className="route-columns">
              <div className="stack">
                <p className="field-kicker">Saída</p>
                <label>
                  Origem
                  <input name="origin" list="airports" value={origin} required placeholder="GYN" autoComplete="off" spellCheck={false} onChange={(event) => setOrigin(codeValue(event.target.value))} />
                </label>
                <label>
                  Origem alternativa
                  <input name="originAlt1" list="airports" value={originAlts[0]} placeholder="BSB" autoComplete="off" spellCheck={false} onChange={(event) => setOriginAlts([codeValue(event.target.value), originAlts[1]])} />
                </label>
                <label>
                  Outra origem
                  <input name="originAlt2" list="airports" value={originAlts[1]} autoComplete="off" spellCheck={false} onChange={(event) => setOriginAlts([originAlts[0], codeValue(event.target.value)])} />
                </label>
              </div>
              <div className="stack">
                <p className="field-kicker">Chegada</p>
                <label>
                  Destino
                  <input name="destination" list="airports" value={destination} required placeholder="LIS" autoComplete="off" spellCheck={false} onChange={(event) => setDestination(codeValue(event.target.value))} />
                </label>
                <label>
                  Destino alternativo
                  <input name="destinationAlt1" list="airports" value={destinationAlts[0]} placeholder="OPO" autoComplete="off" spellCheck={false} onChange={(event) => setDestinationAlts([codeValue(event.target.value), destinationAlts[1]])} />
                </label>
                <label>
                  Outro destino
                  <input name="destinationAlt2" list="airports" value={destinationAlts[1]} autoComplete="off" spellCheck={false} onChange={(event) => setDestinationAlts([destinationAlts[0], codeValue(event.target.value)])} />
                </label>
              </div>
            </div>
            <p className="muted">Os aeroportos alternativos são escolhidos manualmente. Não há busca por raio.</p>
          </fieldset>
          <fieldset className="card fields">
            <legend>Datas e passageiros</legend>
            <div className="form-grid">
              <label>
                Ida
                <input type="date" name="departDate" defaultValue={defaults.departDate} required />
              </label>
              <label>
                Volta
                <input type="date" name="returnDate" defaultValue={defaults.returnDate} required />
              </label>
              <label>
                Flexibilidade
                <select name="flexDays" defaultValue={String(defaults.flexDays)}>
                  <option value="0">Datas fixas</option>
                  <option value="1">±1 dia</option>
                  <option value="3">±3 dias</option>
                </select>
              </label>
              <label>
                Adultos
                <input type="number" name="adults" min={1} max={6} defaultValue={defaults.adults} required />
              </label>
              <label>
                Idades das crianças
                <input name="childAges" defaultValue={defaults.childAges} placeholder="vazio, ou 4, 9" />
              </label>
              <label>
                Cabine
                <select name="cabin" defaultValue={defaults.cabin}>
                  <option value="ECONOMY">Econômica</option>
                  <option value="PREMIUM_ECONOMY">Econômica premium</option>
                  <option value="BUSINESS">Executiva</option>
                  <option value="FIRST">Primeira classe</option>
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset className="card fields">
            <legend>Filtros da consulta</legend>
            <div className="form-grid">
              <label>
                Mala despachada desejada
                <select name="bags" defaultValue={defaults.bags}>
                  <option value="unset">Não especificar</option>
                  <option value="0">Sem mala despachada</option>
                  <option value="1">1 mala despachada</option>
                  <option value="2">2 malas despachadas</option>
                </select>
              </label>
              <label>
                Moeda da consulta
                <select name="currency" defaultValue={defaults.currency}>
                  <option value="BRL">BRL</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label>
                Mercado
                <select name="market" defaultValue={defaults.market}>
                  <option value="BR">BR</option>
                  <option value="PT">PT</option>
                  <option value="US">US</option>
                </select>
              </label>
              <label>
                Máximo de conexões
                <select name="maxStops" defaultValue={String(defaults.maxStops)}>
                  <option value="0">Somente voo direto</option>
                  <option value="1">Até 1 conexão</option>
                  <option value="2">Até 2 conexões</option>
                </select>
              </label>
              <label>
                Duração máxima por sentido
                <select name="maxDurationHours" defaultValue={String(defaults.maxDurationHours)}>
                  <option value="8">8 horas</option>
                  <option value="12">12 horas</option>
                  <option value="20">20 horas</option>
                  <option value="30">30 horas</option>
                </select>
              </label>
            </div>
          </fieldset>
          {mode === "monitor" ? (
            <fieldset className="card fields">
              <legend>Acompanhamento</legend>
              <div className="form-grid">
                <label>
                  Acompanhar até
                  <input type="date" name="monitorUntil" defaultValue={defaults.monitorUntil} required />
                </label>
                <label>
                  Preço-alvo
                  <input name="targetAmount" defaultValue={defaults.targetAmount} inputMode="decimal" required placeholder="8000,00" />
                </label>
                <label>
                  O preço-alvo vale
                  <select name="budgetScope" defaultValue={defaults.budgetScope}>
                    <option value="TOTAL">para todos os passageiros</option>
                    <option value="PER_PERSON">por pessoa</option>
                  </select>
                </label>
                <label>
                  Queda percentual
                  <input name="percentDrop" defaultValue={defaults.percentDrop} inputMode="numeric" placeholder="10" />
                </label>
                <label>
                  Economia mínima no alternativo
                  <input name="minSavings" defaultValue={defaults.minSavings} inputMode="decimal" placeholder="300,00" />
                </label>
                <label>
                  Preço de cada mala que falta
                  <input name="extraBagAmount" defaultValue={defaults.extraBagAmount} inputMode="decimal" placeholder="não informado" />
                </label>
              </div>
              <label className="check">
                <input type="checkbox" name="newLow" defaultChecked={defaults.newLow} />
                Avisar quando surgir um preço menor que o menor já visto neste monitoramento
              </label>
              <input type="hidden" name="alertFields" value="1" />
              <GroundCostFields
                airports={[origin, originAlts[0], originAlts[1], destination, destinationAlts[0], destinationAlts[1]]}
                saved={defaults.groundCosts}
              />
              <p className="notice">
                A frequência é fixa: uma rodada a cada 12 horas, no servidor, mesmo com o navegador fechado. Uma rodada nesse intervalo pode perder promoções mais curtas.
                Cada rodada consulta no máximo 8 combinações. Com histórico, a rodada confirma primeiro as combinações que já têm preço e usa o restante da cota para datas e aeroportos ainda pouco consultados. Sem calendário indicativo autorizado, nenhum preço indicativo é inventado. Se a rodada não cobrir tudo, o menor preço é o menor entre as opções consultadas.
              </p>
            </fieldset>
          ) : (
            <p className="notice">A busca é de ida e volta. O resultado traz preços de demonstração, com a data da consulta.</p>
          )}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Consultando…" : submitLabel}
          </button>
        </div>
        <aside className="card planner-map stack">
          <h2>Rota no mapa</h2>
          <p className="muted">Clique num aeroporto próximo para escolhê-lo como alternativa. A linha cheia é a rota principal; a tracejada é a alternativa.</p>
          <RouteMap model={model} onPick={pick} />
        </aside>
      </div>
      <datalist id="airports">
        {airports.map((airport) => (
          <option key={airport.iata} value={airport.iata}>
            {airportLabel(airport)}
          </option>
        ))}
      </datalist>
    </form>
  );
}
