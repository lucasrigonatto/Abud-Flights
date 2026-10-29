"use server";

import { redirect } from "next/navigation";
import { clearSession, getSessionUser, requireUser, setSession } from "../lib/auth";
import { parseTripForm } from "../lib/parse-trip";
import { hashPassword, verifyPassword } from "../lib/password";
import { prisma } from "../infra/prisma";
import { createMonitor, runAdhocSearch, setMonitorStatus, updateMonitor } from "../infra/monitors";
import { AIRPORTS } from "../lib/airports";

export type ActionState = { error: string; saved?: boolean };

function requestKey(formData: FormData): string | null {
  const key = String(formData.get("requestKey") ?? "");
  return /^[a-zA-Z0-9-]{8,80}$/.test(key) ? key : null;
}

async function airportSet() {
  const airports = await prisma.airport.findMany({ select: { iata: true } });
  const codes = new Set(AIRPORTS.map((airport) => airport.iata));
  for (const airport of airports) codes.add(airport.iata);
  return codes;
}

export async function registerAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2 || name.length > 80) return { error: "Informe seu nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "Já existe uma conta com esse e-mail." };
  const user = await prisma.user.create({
    data: { email, name, passwordHash: await hashPassword(password) },
  });
  await setSession(user.id);
  redirect("/monitoramentos");
}

export async function loginAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos." };
  }
  await setSession(user.id);
  redirect("/monitoramentos");
}

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function searchAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const parsed = parseTripForm(formData, await airportSet(), "search");
  if (!parsed.ok) return { error: parsed.error };
  const key = requestKey(formData);
  if (!key) return { error: "Recarregue a página e busque de novo." };
  const result = await runAdhocSearch(user.id, parsed.value.criteria, key);
  redirect(`/busca/${result.runId}`);
}

export async function createMonitorAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const parsed = parseTripForm(formData, await airportSet(), "monitor");
  if (!parsed.ok) return { error: parsed.error };
  if (!parsed.value.monitorUntil || parsed.value.targetAmountMinor === null) {
    return { error: "Informe o prazo e o preço-alvo." };
  }
  let monitorId = "";
  try {
    const monitor = await createMonitor(user.id, {
      criteria: parsed.value.criteria,
      name: parsed.value.name,
      monitorUntil: parsed.value.monitorUntil,
      targetAmountMinor: parsed.value.targetAmountMinor,
      budgetScope: parsed.value.budgetScope,
    });
    monitorId = monitor.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível criar o monitoramento." };
  }
  redirect(`/monitoramentos/${monitorId}`);
}

export async function updateMonitorAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) redirect("/entrar");
  const monitorId = String(formData.get("monitorId") ?? "");
  const parsed = parseTripForm(formData, await airportSet(), "monitor");
  if (!parsed.ok) return { error: parsed.error };
  if (!parsed.value.monitorUntil || parsed.value.targetAmountMinor === null) {
    return { error: "Informe o prazo e o preço-alvo." };
  }
  try {
    await updateMonitor(user.id, monitorId, {
      criteria: parsed.value.criteria,
      name: parsed.value.name,
      monitorUntil: parsed.value.monitorUntil,
      targetAmountMinor: parsed.value.targetAmountMinor,
      budgetScope: parsed.value.budgetScope,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar os filtros." };
  }
  redirect(`/monitoramentos/${monitorId}`);
}

async function changeStatus(formData: FormData, status: "ACTIVE" | "PAUSED" | "CANCELLED") {
  const user = await requireUser();
  const monitorId = String(formData.get("monitorId") ?? "");
  try {
    await setMonitorStatus(user.id, monitorId, status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar o monitoramento.";
    redirect(`/monitoramentos/${monitorId}?erro=${encodeURIComponent(message)}`);
  }
  redirect(`/monitoramentos/${monitorId}`);
}

export async function pauseMonitorAction(formData: FormData) {
  await changeStatus(formData, "PAUSED");
}

export async function resumeMonitorAction(formData: FormData) {
  await changeStatus(formData, "ACTIVE");
}

export async function cancelMonitorAction(formData: FormData) {
  await changeStatus(formData, "CANCELLED");
}

export async function updatePreferencesAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const currency = String(formData.get("currency") ?? "BRL");
  const market = String(formData.get("market") ?? "BR").toUpperCase();
  if (!["BRL", "EUR", "USD"].includes(currency)) return { error: "Escolha BRL, EUR ou USD." };
  if (!/^[A-Z]{2}$/.test(market)) return { error: "Informe o mercado com duas letras." };
  await prisma.user.update({ where: { id: user.id }, data: { currency, market } });
  return { error: "", saved: true };
}

export async function markAlertReadAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("notificationId") ?? "");
  await prisma.notification.updateMany({
    where: { id, userId: user.id, channel: "IN_APP" },
    data: { readAt: new Date() },
  });
  redirect("/alertas");
}
