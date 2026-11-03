import { randomUUID } from "crypto";
import { TripForm } from "../../components/trip-form";
import { Limitations } from "../../components/limitations";
import { searchAction } from "../actions";
import { requireUser } from "../../lib/auth";
import { isoDateInTimeZone } from "../../domain/dates";
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
          <h1>Buscar tarifas</h1>
          <p className="lede">Qualquer aeroporto comercial, ida e volta ou somente ida. A consulta fica salva com a data em que o preço foi obtido.</p>
        </div>
      </header>
      <TripForm key={requestKey} action={searchAction} requestKey={requestKey} defaults={defaults} mode="search" submitLabel="Buscar" />
      <Limitations />
    </div>
  );
}
