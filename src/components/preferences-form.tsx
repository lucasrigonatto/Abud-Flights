"use client";

import { useActionState } from "react";
import { updatePreferencesAction, type ActionState } from "../app/actions";

export function PreferencesForm({ currency, market }: { currency: string; market: string }) {
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
      </div>
      <button className="btn" type="submit" disabled={pending}>
        Salvar
      </button>
    </form>
  );
}
