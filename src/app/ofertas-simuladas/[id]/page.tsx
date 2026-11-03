import Link from "next/link";

export default async function SimulatedOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section className="card stack">
      <p className="badge badge-demo">Preço de demonstração</p>
      <h1>Link de demonstração</h1>
      <p>O identificador {id} veio do simulador. Este endereço não é o site da companhia e não é uma página de compra, reserva ou pagamento.</p>
      <p>A Abud Flights compara o preço direto das companhias. Quando a fonte tiver um link real da viagem, ele abre na companhia ou na fonte. Não é uma tarifa ao vivo.</p>
      <Link href="/busca">Voltar à busca</Link>
    </section>
  );
}
