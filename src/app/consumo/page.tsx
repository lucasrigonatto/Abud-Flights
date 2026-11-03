import { buildConsumptionReport } from "../../domain/consumption";
import { saoPauloMonth, formatDateTime } from "../../domain/dates";
import { formatMoney } from "../../domain/money";
import { runStatusLabel } from "../../domain/labels";
import type { RunStatus } from "../../domain/coverage";
import { requireUser } from "../../lib/auth";
import { prisma } from "../../infra/prisma";
import { Limitations } from "../../components/limitations";
import { ProviderError } from "../../domain/provider";
import { checkSerpApiAccount, type FreeAccount } from "../../providers/serpapi";
import { freeSearchLimit, providerSettings } from "../../providers/settings";

export default async function ConsumptionPage() {
  const user = await requireUser();
  const settings = providerSettings();
  let quota: FreeAccount | null = null;
  let quotaError: string | null = null;
  if (settings.live) {
    try {
      quota = await checkSerpApiAccount({
        apiKey: process.env.SERPAPI_API_KEY,
        monthlyLimit: freeSearchLimit(),
      });
    } catch (error) {
      quotaError =
        error instanceof ProviderError
          ? error.message
          : "Não foi possível verificar a cota gratuita.";
    }
  }
  const now = new Date();
  const month = saoPauloMonth(now);
  const [requests, runs, monitors] = await Promise.all([
    prisma.providerRequest.findMany({
      where: {
        userId: user.id,
        provider: settings.name,
        createdAt: { gte: month.start },
      },
    }),
    prisma.searchRun.findMany({
      where: {
        userId: user.id,
        startedAt: { gte: month.start },
        requests: { some: { provider: settings.name } },
      },
      include: { monitor: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.monitor.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    }),
  ]);
  const names = new Map(monitors.map((monitor) => [monitor.id, monitor.name]));
  const report = buildConsumptionReport({
    requests: requests.map((request) => ({
      monitorId: request.monitorId,
      monitorName: request.monitorId
        ? (names.get(request.monitorId) ?? "Monitoramento")
        : "Busca avulsa",
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
      monitorName:
        run.monitor?.name ??
        (run.monitorId ? (names.get(run.monitorId) ?? null) : "Busca avulsa"),
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
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {settings.live ? "SerpApi · plano Free" : "Simulador"}
          </p>
          <h1>Consumo</h1>
        </div>
      </header>
      <p className="muted">
        {settings.live
          ? "O contador do aplicativo registra buscas, cache e falhas. Uma busca de ida e volta pode consumir duas consultas na SerpApi. A cota real da conta, incluindo outros aplicativos que usam a chave, aparece abaixo. Não é uma fatura."
          : "Os valores abaixo são custo de demonstração do simulador, em centavos de USD, não uma fatura. Incluem chamadas cobradas, cache, falhas e repetições."}
      </p>
      {settings.live ? (
        <section className="card stack">
          <h2>Cota gratuita da conta</h2>
          {quota ? (
            <p>
              {quota.monthlyUsed} consultas usadas no ciclo atual.{" "}
              {quota.projectRemaining} disponíveis dentro do limite de{" "}
              {quota.projectLimit} do projeto. {quota.planRemaining} restantes
              no plano Free.
            </p>
          ) : null}
          {quota?.projectRemaining === 0 ? (
            <p className="notice">
              Novas consultas estão pausadas até a renovação da cota.
            </p>
          ) : null}
          {quotaError ? (
            <p className="notice" role="alert">
              {quotaError}
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="stat-grid">
        <article className="card">
          <h2>Buscas do aplicativo no mês</h2>
          <p>{report.monthRequests}</p>
          <p className="muted">
            {report.monthCharged} externas · {report.monthCacheHits} vindas do
            cache
          </p>
        </article>
        <article className="card">
          <h2>Cache</h2>
          <p>
            {report.cachePercent === null
              ? "sem consultas"
              : `${report.cachePercent}%`}
          </p>
        </article>
        <article className="card">
          <h2>Falhas e repetições</h2>
          <p>
            {report.monthFailures} falhas · {report.monthRetries} tentativas
            extras
          </p>
        </article>
        <article className="card">
          <h2>
            {settings.live ? "Custo no plano Free" : "Custo de demonstração"}
          </h2>
          <p>{formatMoney(report.monthCostMinor, "USD")}</p>
          <p className="muted">
            Estimativa do mês:{" "}
            {formatMoney(report.estimatedMonthCostMinor, "USD")}
          </p>
        </article>
        <article className="card">
          <h2>Combinações analisadas</h2>
          <p>{report.combinationsQueried}</p>
        </article>
        <article className="card">
          <h2>Custo por oferta</h2>
          <p>
            {report.costPerOfferMinor === null
              ? "sem oferta no mês"
              : formatMoney(report.costPerOfferMinor, "USD")}
          </p>
          <p className="muted">{report.offersFound} ofertas encontradas</p>
        </article>
      </section>
      <section className="card stack">
        <h2>Por monitoramento</h2>
        {report.byMonitor.length === 0 ? (
          <p className="muted">Nenhuma consulta de monitoramento neste mês.</p>
        ) : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Monitoramento</th>
                <th>Consultas</th>
                <th>Externas</th>
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
                <th>Externas</th>
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
