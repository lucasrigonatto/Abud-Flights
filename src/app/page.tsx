import Link from "next/link";
import { Limitations } from "../components/limitations";
import { getSessionUser } from "../lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  return (
    <div className="stack">
      <section className="hero">
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
