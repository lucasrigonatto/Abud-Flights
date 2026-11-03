import { HomeShowcase } from "../components/home-showcase";
import { Limitations } from "../components/limitations";
import { getSessionUser } from "../lib/auth";

export default async function HomePage() {
  const user = await getSessionUser();
  return (
    <div className="stack">
      <HomeShowcase signedIn={Boolean(user)} />
      <section className="feature-grid">
        <article className="card">
          <h2>Busca global</h2>
          <p>Origem e destino aceitam qualquer aeroporto comercial. A rota não fica presa a um par de cidades.</p>
        </article>
        <article className="card">
          <h2>Ida e volta ou somente ida</h2>
          <p>Somente ida acompanha o trecho de saída. A volta não é obrigatória.</p>
        </article>
        <article className="card">
          <h2>Até cinco alternativas</h2>
          <p>Origem e destino alternativos são escolhidos à mão, até cinco de cada lado. Não há busca por raio.</p>
        </article>
        <article className="card">
          <h2>Tarifa da rota</h2>
          <p>A comparação mostra a rota e a tarifa. O botão da oferta abre a busca ao vivo no Google Voos.</p>
        </article>
        <article className="card">
          <h2>Histórico</h2>
          <p>Gráfico, matriz de datas e a leitura abaixo, dentro ou acima do histórico. Amostra pequena mostra “Histórico insuficiente.”</p>
        </article>
        <article className="card">
          <h2>Alertas</h2>
          <p>Preço-alvo, queda percentual, novo menor preço, economia no alternativo, horário de silêncio e resumo diário.</p>
        </article>
        <article className="card">
          <h2>Link da viagem</h2>
          <p>O próximo passo abre o endereço daquela viagem. Sem URL real, o link fica marcado como demonstração.</p>
        </article>
        <article className="card">
          <h2>Preço de demonstração</h2>
          <p>O fornecedor desta versão é um simulador. Cada preço fica identificado na tela e no banco. Não é uma tarifa ao vivo.</p>
        </article>
      </section>
      <Limitations />
    </div>
  );
}