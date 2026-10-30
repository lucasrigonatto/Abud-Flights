import { randomUUID } from "crypto";
import { TripForm } from "../../components/trip-form";
import { Limitations } from "../../components/limitations";
import { searchAction } from "../actions";
import { requireUser } from "../../lib/auth";
import { isoDateInTimeZone } from "../../domain/dates";
import { AIRPORTS } from "../../lib/airports";
import { blankTrip } from "../../lib/trip-defaults";

export default async function SearchPage() {
  const user = await requireUser();
  const defaults = blankTrip({ currency: user.currency, market: user.market, today: isoDateInTimeZone(new Date()) });
  const requestKey = randomUUID();
  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <p className="eyebrow">Consulta imediata</p>
          <h1>Buscar ida e volta</h1>
          <p className="lede">A consulta roda agora e fica salva na sua conta, com a data em que o preço foi obtido.</p>
        </div>
      </header>
      <TripForm key={requestKey} action={searchAction} airports={AIRPORTS} requestKey={requestKey} defaults={defaults} mode="search" submitLabel="Buscar" />
      <Limitations />
    </div>
  );
}
