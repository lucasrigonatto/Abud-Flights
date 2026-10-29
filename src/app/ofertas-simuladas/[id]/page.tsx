import Link from "next/link";

export default async function SimulatedOfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <section className="card stack">
      <p className="badge badge-demo">Preço de demonstração</p>
      <h1>Oferta simulada</h1>
      <p>O identificador {id} veio do provedor simulado. A Abud Flights não emite passagem, não recebe pagamento e não altera reserva.</p>
      <p>Este detalhe não é uma tarifa ao vivo nem um link de compra.</p>
      <Link href="/busca">Voltar à busca</Link>
    </section>
  );
}
