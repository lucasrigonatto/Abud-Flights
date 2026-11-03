"use client";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="card stack">
      <h1>Algo deu errado</h1>
      <p>A página não conseguiu terminar. Tente de novo em instantes.</p>
      <button className="btn" type="button" onClick={() => reset()}>
        Tentar de novo
      </button>
    </section>
  );
}
