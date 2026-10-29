"use client";

import { useActionState } from "react";
import type { ActionState } from "../app/actions";
import type { AirportRecord } from "../lib/airports";
import { airportLabel } from "../lib/airports";
import type { TripDefaults } from "../lib/trip-defaults";

export type { TripDefaults };

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
  return (
    <form action={formAction} className="stack">
      {requestKey ? <input type="hidden" name="requestKey" value={requestKey} /> : null}
      {defaults.monitorId ? <input type="hidden" name="monitorId" value={defaults.monitorId} /> : null}
      {state.error ? <p className="notice notice-danger">{state.error}</p> : null}
      {mode === "monitor" ? (
        <label>
          Nome
          <input name="name" defaultValue={defaults.name} maxLength={80} />
        </label>
      ) : null}
      <div className="form-grid">
        <label>
          Origem
          <input name="origin" list="airports" defaultValue={defaults.origin} required placeholder="GYN" />
        </label>
        <label>
          Destino
          <input name="destination" list="airports" defaultValue={defaults.destination} required placeholder="LIS" />
        </label>
        <label>
          Origem alternativa
          <input name="originAlt1" list="airports" defaultValue={defaults.originAlt1} placeholder="BSB" />
        </label>
        <label>
          Outra origem
          <input name="originAlt2" list="airports" defaultValue={defaults.originAlt2} />
        </label>
        <label>
          Destino alternativo
          <input name="destinationAlt1" list="airports" defaultValue={defaults.destinationAlt1} placeholder="OPO" />
        </label>
        <label>
          Outro destino
          <input name="destinationAlt2" list="airports" defaultValue={defaults.destinationAlt2} />
        </label>
      </div>
      <datalist id="airports">
        {airports.map((airport) => (
          <option key={airport.iata} value={airport.iata}>
            {airportLabel(airport)}
          </option>
        ))}
      </datalist>
      <p className="muted">Os aeroportos alternativos são escolhidos manualmente. Não há busca por raio.</p>
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
      {mode === "monitor" ? (
        <>
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
          </div>
          <p className="notice">
            A frequência é fixa: uma rodada a cada 12 horas, no servidor, mesmo com o navegador fechado. Uma rodada nesse intervalo pode perder promoções mais curtas.
            Cada rodada consulta no máximo 8 combinações. Se houver mais, a cobertura fica parcial.
          </p>
        </>
      ) : (
        <p className="notice">A busca é de ida e volta. O resultado traz preços de demonstração, com a data da consulta.</p>
      )}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Consultando…" : submitLabel}
      </button>
    </form>
  );
}
