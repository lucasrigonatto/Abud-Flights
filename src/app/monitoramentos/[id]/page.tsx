import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelMonitorAction, pauseMonitorAction, resumeMonitorAction, updateMonitorAction } from "../../actions";
import { coverageMessage } from "../../../domain/coverage";
import { inclusiveUntilDate, isoFromUtcDate, isoDateInTimeZone, formatDateTime, formatCivilDate } from "../../../domain/dates";
import { buildCombinations } from "../../../domain/combinations";
import { budgetScopeLabel, cabinLabel, monitorStatusLabel, runStatusLabel } from "../../../domain/labels";
import { formatMoney, minorToInput } from "../../../domain/money";
import { LIMITS } from "../../../domain/limits";
import { HistoryPanel } from "../../../components/history-panel";
import { Limitations } from "../../../components/limitations";
import { OfferList } from "../../../components/offers";
import { TripForm, type TripDefaults } from "../../../components/trip-form";
import { criteriaFromMonitor } from "../../../infra/run-monitor";
import { requireUser } from "../../../lib/auth";
import { AIRPORTS } from "../../../lib/airports";
import { prisma } from "../../../infra/prisma";

export default async function MonitorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { erro } = await searchParams;
  const monitor = await prisma.monitor.findFirst({
    where: { id, userId: user.id },
    include: {
      alertRules: true,
      revisions: { orderBy: { filtersVersion: "desc" } },
      runs: { orderBy: { startedAt: "desc" }, take: 12 },
      notifications: { orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!monitor) notFound();
  const [observations, requests, shared] = await Promise.all([
    prisma.priceObservation.findMany({
      where: { monitorId: monitor.id, userId: user.id },
      include: { itinerary: { include: { segments: true } } },
      orderBy: { sourceCollectedAt: "desc" },
      take: 300,
    }),
    prisma.providerRequest.findMany({
      where: { monitorId: monitor.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.routeDailyStat.findMany({
      where: {
        origin: monitor.origins[0],
        destination: monitor.destinations[0],
        currency: monitor.currency,
        cabin: monitor.cabin,
        priceKind: "DEMONSTRATION",
      },
    }),
  ]);
  const latest = monitor.runs[0];
  const lastSuccess = monitor.runs.find((run) => run.status === "SUCCESS" || run.status === "PARTIAL" || run.status === "NO_OFFERS");
  const latestOffers = latest ? observations.filter((observation) => observation.searchRunId === latest.id) : [];
  const currentObservations = observations.filter((observation) => observation.filtersVersion === monitor.filtersVersion);
  const previous = observations.filter((observation) => observation.filtersVersion !== monitor.filtersVersion);
  const rule = monitor.alertRules[0];
  const today = isoDateInTimeZone(new Date());
  const planned = buildCombinations(criteriaFromMonitor(monitor), today).length;
  const sharedSample = shared.reduce((sum, stat) => sum + stat.sampleCount, 0);
  const defaults: TripDefaults = {
    origin: monitor.origins[0] ?? "",
    originAlt1: monitor.origins[1] ?? "",
    originAlt2: monitor.origins[2] ?? "",
    destination: monitor.destinations[0] ?? "",
    destinationAlt1: monitor.destinations[1] ?? "",
    destinationAlt2: monitor.destinations[2] ?? "",
    departDate: isoFromUtcDate(monitor.departDate),
    returnDate: isoFromUtcDate(monitor.returnDate),
    flexDays: monitor.flexDays,
    adults: monitor.adults,
    childAges: monitor.childAges.join(", "),
    cabin: monitor.cabin,
    bags: monitor.checkedBags === null ? "unset" : String(monitor.checkedBags),
    currency: monitor.currency,
    market: monitor.market,
    maxStops: monitor.maxStops,
    maxDurationHours: Math.round(monitor.maxDurationMinutes / 60),
    name: monitor.name,
    monitorUntil: inclusiveUntilDate(monitor.monitorUntil),
    targetAmount: rule ? minorToInput(rule.targetAmountMinor, rule.currency) : "",
    budgetScope: rule?.scope ?? "TOTAL",
    monitorId: monitor.id,
  };
  const roundRequests = latest ? requests.filter((request) => request.searchRunId === latest.id) : [];
  const charged = roundRequests.filter((request) => request.charged).length;
  const failures = roundRequests.filter((request) => request.status === "error").length;

  return (
    <div className="stack">
      <section className="stack">
        <p className="eyebrow">{monitorStatusLabel(monitor.status)}</p>
        <h1>{monitor.name}</h1>
        <p>
          {monitor.origins.join(", ")} → {monitor.destinations.join(", ")} · ida {formatCivilDate(isoFromUtcDate(monitor.departDate))} · volta{" "}
          {formatCivilDate(isoFromUtcDate(monitor.returnDate))} · {monitor.dateMode === "FIXED" ? "datas fixas" : `flexibilidade de ±${monitor.flexDays} dias`}
        </p>
        <p>
          {monitor.adults} {monitor.adults === 1 ? "adulto" : "adultos"}
          {monitor.childAges.length ? ` · crianças: ${monitor.childAges.join(", ")}` : ""} · {cabinLabel(monitor.cabin)} · critérios versão {monitor.filtersVersion}
        </p>
        {rule ? (
          <p>
            Preço-alvo {formatMoney(rule.targetAmountMinor, rule.currency)} {budgetScopeLabel(rule.scope)}.
          </p>
        ) : null}
        {erro ? <p className="notice notice-danger">{erro}</p> : null}
      </section>

      <section className="stat-grid">
        <article className="card">
          <h2>Próxima execução</h2>
          <p>{monitor.status === "ACTIVE" ? formatDateTime(monitor.nextRunAt) : "Não há execução agendada neste estado."}</p>
          <p className="muted">Intervalo fixo de {monitor.intervalHours} horas. O worker continua com o navegador fechado.</p>
        </article>
        <article className="card">
          <h2>Última consulta bem-sucedida</h2>
          <p>{lastSuccess ? formatDateTime(lastSuccess.finishedAt ?? lastSuccess.startedAt) : "Ainda não houve."}</p>
        </article>
        <article className="card">
          <h2>Última tentativa</h2>
          <p>{latest ? `${formatDateTime(latest.startedAt)} · ${runStatusLabel(latest.status)}` : "Ainda não houve."}</p>
        </article>
      </section>

      {latest ? (
        <p className={latest.status === "FAILED" ? "notice notice-danger" : latest.status === "PARTIAL" ? "notice notice-warn" : "notice"}>
          {coverageMessage({
            status: latest.status,
            combinationsPlanned: latest.combinationsPlanned,
            combinationsQueried: latest.combinationsQueried,
            hadProviderFailure: latest.hadProviderFailure,
            stoppedByBudget: latest.stoppedByBudget,
            datesPassed: latest.datesPassed,
          })}
        </p>
      ) : (
        <p className="notice">A primeira consulta ainda não terminou. O servidor executa a rodada mesmo sem esta página aberta.</p>
      )}
      <p className="muted">
        Combinações previstas agora: {planned}. Cada rodada consulta até {LIMITS.maxCombinationsPerRound}. Nesta última tentativa houve {charged} chamada
        {charged === 1 ? "" : "s"} cobrada{charged === 1 ? "" : "s"} e {failures} falha{failures === 1 ? "" : "s"}.
      </p>

      <OfferList
        rows={latestOffers}
        now={new Date()}
        airports={AIRPORTS}
        route={{ origins: monitor.origins, destinations: monitor.destinations }}
      />
      <HistoryPanel rows={currentObservations} filtersVersion={monitor.filtersVersion} title="Histórico destes critérios" />
      <p className="muted">
        Amostra compartilhada da rota {monitor.origins[0]} → {monitor.destinations[0]}, sem identificar quem pesquisou: {sharedSample} observações de demonstração.
        {sharedSample < 5 ? " Histórico insuficiente na amostra compartilhada." : ""}
      </p>
      {previous.length > 0 ? (
        <details className="card">
          <summary>Critérios anteriores, em histórico separado</summary>
          {[...new Set(previous.map((observation) => observation.filtersVersion).filter((version): version is number => version !== null))]
            .sort((left, right) => right - left)
            .map((version) => (
              <HistoryPanel
                key={version}
                rows={previous.filter((observation) => observation.filtersVersion === version)}
                filtersVersion={version}
                title={`Critérios da versão ${version}`}
              />
            ))}
          <p className="muted">Esses preços não entram na leitura dos critérios atuais.</p>
        </details>
      ) : null}

      <section className="card stack">
        <h2>Alertas</h2>
        {monitor.notifications.length === 0 ? <p className="muted">Nenhum alerta deste monitoramento.</p> : null}
        <ul className="plain-list">
          {monitor.notifications.map((notification) => (
            <li key={notification.id}>
              <strong>{notification.title}</strong>
              <p>{notification.body}</p>
              <p className="muted">
                {notification.channel === "EMAIL" ? "E-mail registrado na caixa de saída. Não há servidor de e-mail." : "Alerta no site."} ·{" "}
                {formatDateTime(notification.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2>Rodadas</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Início</th>
                <th>Situação</th>
                <th>Cobertura</th>
                <th>Tentativa</th>
              </tr>
            </thead>
            <tbody>
              {monitor.runs.map((run) => (
                <tr key={run.id}>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{runStatusLabel(run.status)}</td>
                  <td>
                    {run.combinationsQueried} de {run.combinationsPlanned}
                  </td>
                  <td>{run.attempt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {monitor.revisions.length > 1 ? (
        <section className="card stack">
          <h2>Versões dos filtros</h2>
          <ul className="plain-list">
            {monitor.revisions.map((revision) => (
              <li key={revision.id}>
                Versão {revision.filtersVersion}: {revision.origins.join(", ")} → {revision.destinations.join(", ")}, {revision.adults} adultos,{" "}
                {formatCivilDate(isoFromUtcDate(revision.departDate))} a {formatCivilDate(isoFromUtcDate(revision.returnDate))}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="row">
        {monitor.status === "ACTIVE" ? (
          <form action={pauseMonitorAction}>
            <input type="hidden" name="monitorId" value={monitor.id} />
            <button className="btn btn-secondary" type="submit">
              Pausar
            </button>
          </form>
        ) : null}
        {monitor.status === "PAUSED" ? (
          <form action={resumeMonitorAction}>
            <input type="hidden" name="monitorId" value={monitor.id} />
            <button className="btn" type="submit">
              Retomar
            </button>
          </form>
        ) : null}
        {monitor.status === "ACTIVE" || monitor.status === "PAUSED" ? (
          <form action={cancelMonitorAction}>
            <input type="hidden" name="monitorId" value={monitor.id} />
            <button className="btn btn-danger" type="submit">
              Cancelar
            </button>
          </form>
        ) : null}
        <Link href="/consumo">Ver consumo</Link>
      </div>

      {monitor.status === "ACTIVE" || monitor.status === "PAUSED" ? (
        <section className="stack">
          <h2>Alterar filtros</h2>
          <p className="muted">Mudar a viagem cria uma versão nova. O histórico anterior continua guardado e não é misturado com o novo.</p>
          <TripForm
            key={`${monitor.id}-${monitor.filtersVersion}`}
            action={updateMonitorAction}
            airports={AIRPORTS}
            defaults={defaults}
            mode="monitor"
            submitLabel="Salvar filtros"
          />
        </section>
      ) : null}
      <Limitations />
    </div>
  );
}
