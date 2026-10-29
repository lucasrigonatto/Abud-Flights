import Link from "next/link";
import { Limitations } from "../components/limitations";
import { RouteMap } from "../components/route-map";
import { getSessionUser } from "../lib/auth";
import { AIRPORTS } from "../lib/airports";
import { buildRouteMapModel } from "../lib/route-map";

export default async function HomePage() {
  const user = await getSessionUser();
  const example = buildRouteMapModel({
    airports: AIRPORTS,
    origins: ["GYN", "BSB"],
    destinations: ["LIS", "OPO"],
    segments: [
      { origin: "GYN", destination: "GRU" },
      { origin: "GRU", destination: "LIS" },
      { origin: "LIS", destination: "GYN" },
    ],
    showNearby: true,
  });
  return (
    <div className="stack">
      <section className="hero-grid">
        <div className="hero">
          <p className="eyebrow">Monitor de passagens</p>
          <h1>Acompanhe uma viagem sem precisar deixar a busca aberta.</h1>
          <p className="lede">
            A Abud Flights guarda a ida e volta, os aeroportos que você escolher e um preço-alvo. O servidor consulta de novo a cada 12 horas e avisa no site quando o alvo é atingido.
          </p>
          <div className="row">
            {user ? (
              <Link className="btn" href="/busca">
                Nova busca
              </Link>
            ) : (
              <Link className="btn" href="/criar-conta">
                Criar conta
              </Link>
            )}
            <Link className="btn btn-secondary" href={user ? "/monitoramentos" : "/entrar"}>
              {user ? "Meus monitoramentos" : "Entrar"}
            </Link>
          </div>
        </div>
        <aside className="card stack hero-map">
          <p className="eyebrow">Exemplo no mapa</p>
          <h2>Goiânia → Lisboa</h2>
          <p className="muted">A linha mostra a rota e a conexão. Brasília e Porto são alternativas escolhidas à mão. Os demais pontos são opções próximas.</p>
          <RouteMap model={example} />
        </aside>
      </section>
      <section className="stat-grid">
        <article className="card">
          <h2>Ida e volta</h2>
          <p>Datas fixas ou uma folga pequena, de um ou três dias. Aeroportos alternativos entram só se você os escolher.</p>
        </article>
        <article className="card">
          <h2>Preço de demonstração</h2>
          <p>O único fornecedor desta versão é um simulador. Cada preço fica marcado assim na tela e no banco, separado de uma tarifa ao vivo.</p>
        </article>
        <article className="card">
          <h2>Histórico próprio</h2>
          <p>Uma coleta nova não apaga a anterior. Se os filtros mudam, o histórico antigo permanece separado.</p>
        </article>
      </section>
      <Limitations />
    </div>
  );
}
