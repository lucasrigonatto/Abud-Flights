"use client";

import { useActionState } from "react";
import { updatePreferencesAction, type ActionState } from "../app/actions";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

export function PreferencesForm({
  currency,
  market,
  quietStartHour,
  quietEndHour,
  digestEnabled,
}: {
  currency: string;
  market: string;
  quietStartHour: number | null;
  quietEndHour: number | null;
  digestEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updatePreferencesAction, { error: "" } as ActionState);
  return (
    <form action={formAction} className="card stack">
      <h1>Configurações</h1>
      <p className="muted">Estes valores só preenchem a próxima busca. Eles não alteram monitoramentos já criados.</p>
      {state.error ? <p className="notice notice-danger">{state.error}</p> : null}
      {state.saved ? <p className="notice notice-ok">Preferências salvas.</p> : null}
      <div className="form-grid">
        <label>
          Moeda sugerida
          <select name="currency" defaultValue={currency}>
            <option value="BRL">BRL</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label>
          Mercado sugerido
          <select name="market" defaultValue={market}>
            <option value="BR">BR</option>
            <option value="PT">PT</option>
            <option value="US">US</option>
          </select>
        </label>
        <label>
          Silêncio a partir da hora
          <select name="quietStartHour" defaultValue={quietStartHour ?? ""}>
            <option value="">Sem horário de silêncio</option>
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label>
          Silêncio até a hora
          <select name="quietEndHour" defaultValue={quietEndHour ?? ""}>
            <option value="">Sem horário de silêncio</option>
            {HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="digestEnabled" defaultChecked={digestEnabled} />
        Guardar um resumo diário no site e na caixa de saída
      </label>
      <p className="muted">
        No horário de silêncio, o alerta individual espera. O resumo do dia continua sendo registrado, sem e-mail de verdade: não há servidor de e-mail. O horário segue America/Sao_Paulo.
      </p>
      <button className="btn" type="submit" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}
