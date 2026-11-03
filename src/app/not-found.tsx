import Link from "next/link";

export default function NotFound() {
  return (
    <section className="card stack">
      <h1>Não encontrado</h1>
      <p>Essa página não existe ou não está na sua conta.</p>
      <Link className="btn" href="/monitoramentos">
        Voltar
      </Link>
    </section>
  );
}
