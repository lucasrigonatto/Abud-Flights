import { buildConsumptionReport } from "../../domain/consumption";
import { saoPauloMonth, formatDateTime } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import { runStatusLabel } from "../../domain/labels";
import type { RunStatus } from "../../domain/coverage";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../infra/prisma";
import { Limitations } from "../../components/limitations";

export default async function ConsumptionPage() {
  const user = await requireUser();
  const now = new Date();
  const month = saoPauloMonth(now);
  const [requests, runs, monitors] = await Promise.all([
    prisma.providerRequest.findMany({ where: { userId: user.id, createdAt: { gte: month.start } } }),
    prisma.searchRun.findMany({
      where: { userId: user.id, startedAt: { gte: month.start } },
      include: { monitor: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.monitor.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);
  const names = new Map(monitors.map((monitor) => [monitor.id, monitor.name]));
  const report = buildConsumptionReport({
    requests: requests.map((request) => ({
      monitorId: request.monitorId,
      monitorName: request.monitorId ? names.get(request.monitorId) ?? "Monitoramento" : "Busca avulsa",
      searchRunId: request.searchRunId,
      createdAt: request.createdAt,
      cacheHit: request.cacheHit,
      charged: request.charged,
      costMinor: request.costMinor,
      status: request.status === "error" ? "error" : "ok",
      attempt: request.attempt,
    })),
    runs: runs.map((run) => ({
      id: run.id,
      monitorId: run.monitorId,
      monitorName: run.monitor?.name ?? (run.monitorId ? names.get(run.monitorId) ?? null : "Busca avulsa"),
      combinationsPlanned: run.combinationsPlanned,
      combinationsQueried: run.combinationsQueried,
      offerCount: run.offerCount,
      startedAt: run.startedAt,
      status: run.status,
    })),
    monthStart: month.start,
    daysElapsed: month.daysElapsed,
    daysInMonth: month.daysInMonth,
  });
  return (
    <div className="stack">
      <h1>Consumo</h1>
      <p className="muted">
        Os valores abaixo são custo de demonstração do simulador, em centavos de USD, não uma fatura. Incluem chamadas cobradas, cache, falhas e repetições.
      </p>
      <section className="stat-grid">
        <article className="card">
          <h2>Consultas no mês</h2>
          <p>{report.monthRequests}</p>
          <p className="muted">{report.monthCharged} cobradas · {report.monthCacheHits} vindas do cache</p>
        </article>
        <article className="card">
          <h2>Cache</h2>
          <p>{report.cachePercent === null ? "sem consultas" : `${report.cachePercent}%`}</p>
        </article>
        <article className="card">
          <h2>Falhas e repetições</h2>
          <p>
            {report.monthFailures} falhas · {report.monthRetries} tentativas extras
          </p>
        </article>
        <article className="card">
          <h2>Custo de demonstração</h2>
          <p>{formatMoney(report.monthCostMinor, "USD")}</p>
          <p className="muted">Estimativa do mês: {formatMoney(report.estimatedMonthCostMinor, "USD")}</p>
        </article>
        <article className="card">
          <h2>Combinações analisadas</h2>
          <p>{report.combinationsQueried}</p>
        </article>
        <article className="card">
          <h2>Custo por oferta</h2>
          <p>{report.costPerOfferMinor === null ? "sem oferta no mês" : formatMoney(report.costPerOfferMinor, "USD")}</p>
          <p className="muted">{report.offersFound} ofertas encontradas</p>
        </article>
      </section>
      <section className="card stack">
        <h2>Por monitoramento</h2>
        {report.byMonitor.length === 0 ? <p className="muted">Nenhuma consulta de monitoramento neste mês.</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Monitoramento</th>
                <th>Consultas</th>
                <th>Cobradas</th>
                <th>Cache</th>
                <th>Falhas</th>
                <th>Combinações</th>
                <th>Custo</th>
              </tr>
            </thead>
            <tbody>
              {report.byMonitor.map((item) => (
                <tr key={item.monitorId}>
                  <td>{item.monitorName}</td>
                  <td>{item.requests}</td>
                  <td>{item.charged}</td>
                  <td>{item.cacheHits}</td>
                  <td>{item.failures}</td>
                  <td>{item.combinationsQueried}</td>
                  <td>{formatMoney(item.costMinor, "USD")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card stack">
        <h2>Por rodada</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Origem</th>
                <th>Situação</th>
                <th>Cobradas</th>
                <th>Falhas</th>
                <th>Repetições</th>
                <th>Combinações</th>
              </tr>
            </thead>
            <tbody>
              {report.byRun.map((run) => (
                <tr key={run.searchRunId}>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{run.monitorName ?? "Busca avulsa"}</td>
                  <td>{runStatusLabel(run.status as RunStatus)}</td>
                  <td>{run.charged}</td>
                  <td>{run.failures}</td>
                  <td>{run.retries}</td>
                  <td>
                    {run.combinationsQueried} de {run.combinationsPlanned}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Limitations />
    </div>
  );
}
