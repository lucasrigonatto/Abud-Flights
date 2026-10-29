import { divRound } from "./money";

export type ConsumptionRequest = {
  monitorId: string | null;
  monitorName: string | null;
  searchRunId: string;
  createdAt: Date;
  cacheHit: boolean;
  charged: boolean;
  costMinor: number;
  status: "ok" | "error";
  attempt: number;
};

export type ConsumptionRun = {
  id: string;
  monitorId: string | null;
  monitorName: string | null;
  combinationsPlanned: number;
  combinationsQueried: number;
  offerCount: number;
  startedAt: Date;
  status: string;
};

export type MonitorConsumption = {
  monitorId: string;
  monitorName: string;
  requests: number;
  charged: number;
  cacheHits: number;
  failures: number;
  costMinor: number;
  combinationsQueried: number;
  offers: number;
};

export type RunConsumption = {
  searchRunId: string;
  monitorName: string | null;
  startedAt: Date;
  status: string;
  charged: number;
  failures: number;
  retries: number;
  cacheHits: number;
  combinationsQueried: number;
  combinationsPlanned: number;
  offers: number;
};

export type ConsumptionReport = {
  monthRequests: number;
  monthCharged: number;
  monthCacheHits: number;
  cachePercent: number | null;
  monthFailures: number;
  monthRetries: number;
  monthCostMinor: number;
  estimatedMonthCostMinor: number;
  combinationsQueried: number;
  offersFound: number;
  costPerOfferMinor: number | null;
  byMonitor: MonitorConsumption[];
  byRun: RunConsumption[];
};

export function buildConsumptionReport(input: {
  requests: ConsumptionRequest[];
  runs: ConsumptionRun[];
  monthStart: Date;
  daysElapsed: number;
  daysInMonth: number;
}): ConsumptionReport {
  const monthRequests = input.requests.filter((request) => request.createdAt >= input.monthStart);
  const monthRuns = input.runs.filter((run) => run.startedAt >= input.monthStart);
  const monthCharged = monthRequests.filter((request) => request.charged).length;
  const monthCacheHits = monthRequests.filter((request) => request.cacheHit).length;
  const monthFailures = monthRequests.filter((request) => request.status === "error").length;
  const monthRetries = monthRequests.filter((request) => request.attempt > 1).length;
  const monthCostMinor = monthRequests.reduce((sum, request) => sum + (request.charged ? request.costMinor : 0), 0);
  const combinationsQueried = monthRuns.reduce((sum, run) => sum + run.combinationsQueried, 0);
  const offersFound = monthRuns.reduce((sum, run) => sum + run.offerCount, 0);
  const monitors = new Map<string, MonitorConsumption>();
  for (const request of monthRequests) {
    if (!request.monitorId) continue;
    const current = monitors.get(request.monitorId) ?? {
      monitorId: request.monitorId,
      monitorName: request.monitorName ?? "Monitoramento",
      requests: 0,
      charged: 0,
      cacheHits: 0,
      failures: 0,
      costMinor: 0,
      combinationsQueried: 0,
      offers: 0,
    };
    current.requests += 1;
    if (request.charged) current.charged += 1;
    if (request.cacheHit) current.cacheHits += 1;
    if (request.status === "error") current.failures += 1;
    if (request.charged) current.costMinor += request.costMinor;
    monitors.set(request.monitorId, current);
  }
  for (const run of monthRuns) {
    if (!run.monitorId) continue;
    const current = monitors.get(run.monitorId);
    if (!current) continue;
    current.combinationsQueried += run.combinationsQueried;
    current.offers += run.offerCount;
  }
  const byRun = monthRuns.slice(0, 12).map((run) => {
    const requests = monthRequests.filter((request) => request.searchRunId === run.id);
    return {
      searchRunId: run.id,
      monitorName: run.monitorName,
      startedAt: run.startedAt,
      status: run.status,
      charged: requests.filter((request) => request.charged).length,
      failures: requests.filter((request) => request.status === "error").length,
      retries: requests.filter((request) => request.attempt > 1).length,
      cacheHits: requests.filter((request) => request.cacheHit).length,
      combinationsQueried: run.combinationsQueried,
      combinationsPlanned: run.combinationsPlanned,
      offers: run.offerCount,
    };
  });
  return {
    monthRequests: monthRequests.length,
    monthCharged,
    monthCacheHits,
    cachePercent: monthRequests.length === 0 ? null : Math.floor((monthCacheHits * 100) / monthRequests.length),
    monthFailures,
    monthRetries,
    monthCostMinor,
    estimatedMonthCostMinor:
      input.daysElapsed > 0 ? divRound(monthCostMinor * input.daysInMonth, input.daysElapsed) : monthCostMinor,
    combinationsQueried,
    offersFound,
    costPerOfferMinor: offersFound > 0 ? Math.floor(monthCostMinor / offersFound) : null,
    byMonitor: [...monitors.values()],
    byRun,
  };
}
