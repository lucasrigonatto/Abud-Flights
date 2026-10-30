import Link from "next/link";
import { notFound } from "next/navigation";
import { coverageMessage } from "../../../domain/coverage";
import { runStatusLabel } from "../../../domain/labels";
import { HistoryPanel, historyForSearch } from "../../../components/history-panel";
import { Limitations } from "../../../components/limitations";
import { OfferList } from "../../../components/offers";
import { requireUser } from "../../../lib/auth";
import { AIRPORTS } from "../../../lib/airports";
import { prisma } from "../../../infra/prisma";

export default async function SearchResultPage({ params }: { params: Promise<{ runId: string }> }) {
  const user = await requireUser();
  const { runId } = await params;
  const run = await prisma.searchRun.findFirst({ where: { id: runId, userId: user.id } });
  if (!run) notFound();
  const [rows, history] = await Promise.all([
    prisma.priceObservation.findMany({
      where: { searchRunId: run.id, userId: user.id },
      include: { itinerary: { include: { segments: true } } },
      orderBy: { totalAmountMinor: "asc" },
    }),
    prisma.priceObservation.findMany({
      where: { userId: user.id, filtersVersion: 0 },
      orderBy: { sourceCollectedAt: "desc" },
      take: 400,
    }),
  ]);
  const message = coverageMessage({
    status: run.status,
    combinationsPlanned: run.combinationsPlanned,
    combinationsQueried: run.combinationsQueried,
    hadProviderFailure: run.hadProviderFailure,
    stoppedByBudget: run.stoppedByBudget,
    datesPassed: run.datesPassed,
  });
  const tone = run.status === "FAILED" ? "notice-danger" : run.status === "PARTIAL" ? "notice-warn" : "notice";
  return (
    <div className="stack">
      <section className="stack">
        <p className="eyebrow">{runStatusLabel(run.status)}</p>
        <h1>Resultado da busca</h1>
        <p className={tone}>{message}</p>
        <p className="muted">
          {run.combinationsQueried} de {run.combinationsPlanned} combinações consultadas nesta rodada. Cada rodada tem um teto de combinações. Sem histórico anterior, a consulta segue a fila. Com histórico, a rodada confirma primeiro as combinações já precificadas e deixa o restante da cota para as menos consultadas. Não há calendário indicativo autorizado, então nenhum preço indicativo é inventado.
        </p>
      </section>
      <OfferList rows={rows} now={new Date()} airports={AIRPORTS} />
      {rows.length === 0 && run.status !== "FAILED" ? <p>Nenhuma oferta foi gravada nesta consulta.</p> : null}
      <HistoryPanel rows={historyForSearch(rows, history)} filtersVersion={0} title="Histórico comparável" />
      <Limitations />
      <Link href="/monitoramentos/novo">Criar um monitoramento</Link>
    </div>
  );
}
