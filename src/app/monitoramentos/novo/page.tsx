import { Limitations } from "../../../components/limitations";
import { TripForm } from "../../../components/trip-form";
import { createMonitorAction } from "../../actions";
import { isoDateInTimeZone } from "../../../domain/dates";
import { requireUser } from "../../../lib/auth";
import { AIRPORTS } from "../../../lib/airports";
import { blankTrip } from "../../../lib/trip-defaults";

export default async function NewMonitorPage() {
  const user = await requireUser();
  const defaults = blankTrip({ currency: user.currency, market: user.market, today: isoDateInTimeZone(new Date()) });
  return (
    <div className="stack">
      <section className="card stack">
        <h1>Criar monitoramento</h1>
        <p className="muted">O período da viagem e o período do monitoramento são campos separados. A primeira rodada começa assim que você salva.</p>
        <TripForm
          action={createMonitorAction}
          airports={AIRPORTS}
          defaults={defaults}
          mode="monitor"
          submitLabel="Começar a acompanhar"
        />
      </section>
      <Limitations />
    </div>
  );
}
