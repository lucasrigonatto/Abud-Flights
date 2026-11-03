"use client";

import { useActionState } from "react";
import type { ActionState } from "../app/actions";

export function AuthForm({
  action,
  title,
  submitLabel,
  includeName = false,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  title: string;
  submitLabel: string;
  includeName?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "" });
  return (
    <form action={formAction} className="card stack auth-card">
      <h1>{title}</h1>
      {state.error ? <p className="notice notice-danger">{state.error}</p> : null}
      {includeName ? (
        <label>
          Nome
          <input name="name" autoComplete="name" required />
        </label>
      ) : null}
      <label>
        E-mail
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Senha
        <input name="password" type="password" autoComplete={includeName ? "new-password" : "current-password"} minLength={8} required />
      </label>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Aguarde…" : submitLabel}
      </button>
    </form>
  );
}
