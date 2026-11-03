import Link from "next/link";
import { formatConsultation, formatDateTime } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import { budgetScopeLabel, monitorStatusLabel } from "../../domain/labels";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../infra/prisma";

export default async function MonitorsPage() {
  const user = await requireUser();
  const monitors = await prisma.monitor.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      alertRules: { where: { active: true }, take: 1 },
      runs: { orderBy: { startedAt: "desc" }, take: 8 },
    },
  });
  const observations = await prisma.priceObservation.findMany({
    where: { userId: user.id, monitorId: { in: monitors.map((monitor) => monitor.id) } },
    select: {
      monitorId: true,
      filtersVersion: true,
      totalAmountMinor: true,
      currency: true,
      sourceCollectedAt: true,
    },
  });
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">Sua conta</p>
          <h1>Meus monitoramentos</h1>
        </div>
        <Link className="btn" href="/monitoramentos/novo">
          Novo monitoramento
        </Link>
      </header>
      {monitors.length === 0 ? (
        <section className="card stack">
          <p>Você ainda não acompanha nenhuma viagem.</p>
          <Link href="/monitoramentos/novo">Criar o primeiro</Link>
        </section>
      ) : (
        <div className="stack">
          {monitors.map((monitor) => {
            const current = observations.filter(
              (observation) => observation.monitorId === monitor.id && observation.filtersVersion === monitor.filtersVersion && observation.currency === monitor.currency,
            );
            const cheapest = current.reduce<(typeof current)[number] | null>(
              (best, observation) => (best === null || observation.totalAmountMinor < best.totalAmountMinor ? observation : best),
              null,
            );
            const lastAttempt = monitor.runs[0];
            const lastSuccess = monitor.runs.find((run) => run.status === "SUCCESS" || run.status === "PARTIAL" || run.status === "NO_OFFERS");
            const rule = monitor.alertRules[0];
            return (
              <article key={monitor.id} className="card stack">
                <div className="row spread">
                  <h2>
                    <Link href={`/monitoramentos/${monitor.id}`}>{monitor.name}</Link>
                  </h2>
                  <span className="badge">{monitorStatusLabel(monitor.status)}</span>
                </div>
                <p>
                  {monitor.origins.join(", ")} → {monitor.destinations.join(", ")} · {monitor.adults}{" "}
                  {monitor.adults === 1 ? "adulto" : "adultos"}
                </p>
                <p>
                  {cheapest ? (
                    <>
                      Menor preço nestes critérios: {formatMoney(cheapest.totalAmountMinor, cheapest.currency)} ·{" "}
                      <time dateTime={cheapest.sourceCollectedAt.toISOString()}>{formatConsultation(cheapest.sourceCollectedAt)}</time>
                    </>
                  ) : (
                    "Ainda não há preço para os critérios atuais."
                  )}
                </p>
                <p className="muted">
                  Última tentativa: {lastAttempt ? formatDateTime(lastAttempt.startedAt) : "nenhuma"}. Última consulta bem-sucedida:{" "}
                  {lastSuccess ? formatDateTime(lastSuccess.finishedAt ?? lastSuccess.startedAt) : "nenhuma"}.
                </p>
                <p className="muted">
                  Próxima execução: {monitor.status === "ACTIVE" ? formatDateTime(monitor.nextRunAt) : "não agendada"}. A cada {monitor.intervalHours} horas.
                  {rule ? ` Preço-alvo ${formatMoney(rule.targetAmountMinor, rule.currency)} ${budgetScopeLabel(rule.scope)}.` : ""}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
