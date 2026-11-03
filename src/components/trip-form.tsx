"use client";

import { useActionState, useMemo, useState } from "react";
import type { ActionState } from "../app/actions";
import type { TripType } from "../domain/provider";
import { AIRPORTS } from "../lib/airports";
import { buildRouteMapModel, type RouteMarker } from "../lib/route-map";
import type { TripDefaults } from "../lib/trip-defaults";
import { AirportField } from "./airport-field";
import { RouteMap } from "./route-map";

export type { TripDefaults };

const MAX_ALTERNATES = 5;

function GroundCostFields({
  airports,
  saved,
}: {
  airports: string[];
  saved: TripDefaults["groundCosts"];
}) {
  const codes = [...new Set(airports.map((code) => code.trim().toUpperCase()).filter((code) => code.length === 3))];
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

function AlternateList({
  name,
  label,
  values,
  onChange,
}: {
  name: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <div className="stack">
      {values.map((value, index) => (
        <div key={`${name}-${index}`} className="alt-row">
          <label>
            {label} {index + 1}
            <AirportField name={name} value={value} onChange={(iata) => onChange(values.map((item, itemIndex) => (itemIndex === index ? iata : item)))} />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))}>
            Remover
          </button>
        </div>
      ))}
      {values.length < MAX_ALTERNATES ? (
        <button type="button" className="btn btn-secondary" onClick={() => onChange([...values, ""])}>
          Adicionar {label.toLowerCase()}
        </button>
      ) : (
        <p className="muted">Limite de cinco alternativas neste lado.</p>
      )}
    </div>
  );
}

export function TripForm({
  action,
  requestKey,
  defaults,
  mode,
  submitLabel,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  requestKey?: string;
  defaults: TripDefaults;
  mode: "search" | "monitor";
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "" });
  const [tripType, setTripType] = useState<TripType>(defaults.tripType);
  const [origin, setOrigin] = useState(defaults.origin);
  const [originAlts, setOriginAlts] = useState(defaults.originAlts.slice(0, MAX_ALTERNATES));
  const [destination, setDestination] = useState(defaults.destination);
  const [destinationAlts, setDestinationAlts] = useState(defaults.destinationAlts.slice(0, MAX_ALTERNATES));
  const [returnDate, setReturnDate] = useState(defaults.returnDate);
  const stopsValue = defaults.maxStops === 1 || defaults.maxStops === 2 ? String(defaults.maxStops) : "";

  const model = useMemo(
    () =>
      buildRouteMapModel({
        airports: AIRPORTS,
        origins: [origin, ...originAlts],
        destinations: [destination, ...destinationAlts],
      }),
    [destination, destinationAlts, origin, originAlts],
  );

  function pick(marker: RouteMarker) {
    if (marker.role === "alternate-origin") setOriginAlts((current) => current.filter((code) => code !== marker.iata));
    if (marker.role === "alternate-destination") setDestinationAlts((current) => current.filter((code) => code !== marker.iata));
  }

  function swapEnds() {
    setOrigin(destination);
    setDestination(origin);
    setOriginAlts(destinationAlts);
    setDestinationAlts(originAlts);
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
              <input name="name" defaultValue={defaults.name} maxLength={80} placeholder="Nome do acompanhamento" />
            </label>
          ) : null}
          <fieldset className="card fields search-band">
            <legend>Viagem</legend>
            <div className="trip-switch" role="radiogroup" aria-label="Tipo de viagem">
              <label>
                <input type="radio" name="tripType" value="ROUND_TRIP" checked={tripType === "ROUND_TRIP"} onChange={() => setTripType("ROUND_TRIP")} />
                <span>Ida e volta</span>
              </label>
              <label>
                <input type="radio" name="tripType" value="ONE_WAY" checked={tripType === "ONE_WAY"} onChange={() => setTripType("ONE_WAY")} />
                <span>Somente ida</span>
              </label>
            </div>
            <p className="muted">
              {tripType === "ONE_WAY"
                ? "Somente ida acompanha o voo de saída. A data de volta não é pedida, nem uma segunda origem ou um segundo destino."
                : "Ida e volta inclui o retorno. Origem e destino alternativos continuam opcionais."}
            </p>
            <div className="search-route">
              <label>
                Origem
                <AirportField name="origin" value={origin} required placeholder="Qualquer aeroporto" onChange={setOrigin} />
              </label>
              <button type="button" className="btn btn-secondary swap" onClick={swapEnds} aria-label="Trocar origem e destino">
                Trocar
              </button>
              <label>
                Destino
                <AirportField name="destination" value={destination} required placeholder="Qualquer aeroporto" onChange={setDestination} />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Ida
                <input type="date" name="departDate" defaultValue={defaults.departDate} required />
              </label>
              {tripType === "ROUND_TRIP" ? (
                <label>
                  Volta
                  <input type="date" name="returnDate" value={returnDate} required onChange={(event) => setReturnDate(event.target.value)} />
                </label>
              ) : null}
              <label>
                Flexibilidade
                <select name="flexDays" defaultValue={String(defaults.flexDays)}>
                  <option value="0">Datas fixas</option>
                  <option value="1">±1 dia</option>
                  <option value="3">±3 dias</option>
                  <option value="5">±5 dias</option>
                </select>
              </label>
              <label>
                Adultos
                <input type="number" name="adults" min={1} max={6} defaultValue={defaults.adults} required />
              </label>
              <fieldset className="choice-set">
                <legend>Crianças</legend>
                <div className="choice-row">
                  <label className="check">
                    <input type="radio" name="hasChildren" value="0" defaultChecked={!defaults.hasChildren} />
                    Não
                  </label>
                  <label className="check">
                    <input type="radio" name="hasChildren" value="1" defaultChecked={defaults.hasChildren} />
                    Sim
                  </label>
                </div>
                <p className="muted">Informe só se há crianças na viagem. A idade não entra nesta pesquisa.</p>
              </fieldset>
              <label>
                Conexões
                <select name="maxStops" defaultValue={stopsValue}>
                  <option value="">Sem limite</option>
                  <option value="1">Até 1 conexão</option>
                  <option value="2">Até 2 conexões</option>
                </select>
              </label>
            </div>
            <p className="muted">Sem limite é o padrão. Até 1 ou até 2 restringe as conexões de cada sentido.</p>
          </fieldset>
          <fieldset className="card fields">
            <legend>Aeroportos alternativos</legend>
            <p className="muted">Os aeroportos alternativos são escolhidos manualmente. Não há busca por raio. Até cinco de cada lado.</p>
            <div className="route-columns">
              <AlternateList name="originAlt" label="Origem alternativa" values={originAlts} onChange={setOriginAlts} />
              <AlternateList name="destinationAlt" label="Destino alternativo" values={destinationAlts} onChange={setDestinationAlts} />
            </div>
          </fieldset>
          <fieldset className="card fields">
            <legend>Filtros da consulta</legend>
            <div className="form-grid">
              <label>
                Cabine
                <select name="cabin" defaultValue={defaults.cabin}>
                  <option value="ECONOMY">Econômica</option>
                  <option value="PREMIUM_ECONOMY">Econômica premium</option>
                  <option value="BUSINESS">Executiva</option>
                  <option value="FIRST">Primeira classe</option>
                </select>
              </label>
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
              <label htmlFor="market">
                Mercado
                <select id="market" name="market" defaultValue={defaults.market} aria-describedby="market-help">
                  <option value="BR">Brasil</option>
                  <option value="PT">Portugal</option>
                  <option value="US">Estados Unidos</option>
                </select>
              </label>
            </div>
            <p id="market-help" className="field-help">
              Mercado é o país em que a passagem é vendida. A mesma rota pode ter preço diferente no Brasil, em Portugal ou nos Estados Unidos, porque a tarifa muda conforme o ponto de venda. A comparação usa o mercado escolhido aqui.
            </p>
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
              <GroundCostFields airports={[origin, ...originAlts, destination, ...destinationAlts]} saved={defaults.groundCosts} />
              <p className="notice">
                A frequência é fixa: uma rodada a cada 12 horas, no servidor, mesmo com o navegador fechado. Uma rodada nesse intervalo pode perder promoções mais curtas.
                Cada rodada consulta no máximo 8 combinações. Com histórico, a rodada confirma primeiro as combinações que já têm preço e usa o restante da cota para datas e aeroportos ainda pouco consultados. Sem calendário indicativo autorizado, nenhum preço indicativo é inventado. Se a rodada não cobrir tudo, o menor preço é o menor entre as opções consultadas.
                {tripType === "ONE_WAY" ? " Somente ida monitora o trecho de saída." : ""}
              </p>
            </fieldset>
          ) : (
            <p className="notice">O resultado traz preços de demonstração, com a data da consulta. A Abud Flights não vende a passagem.</p>
          )}
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Consultando…" : submitLabel}
          </button>
        </div>
        <aside className="card planner-map stack">
          <h2>Rota no mapa</h2>
          <p className="muted">O mapa começa vazio. A rota é desenhada com a origem, o destino e as alternativas que você escolher. Aeroportos não escolhidos não aparecem.</p>
          <RouteMap model={model} onPick={pick} />
        </aside>
      </div>
    </form>
  );
}
