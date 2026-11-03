"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AIRPORTS } from "../lib/airports";
import { buildRouteMapModel } from "../lib/route-map";
import { RouteMap } from "./route-map";

const STEPS = [
  { origins: [] as string[], destinations: [] as string[], caption: "O mapa começa vazio. Nada é desenhado antes da escolha." },
  { origins: ["GYN"], destinations: [], caption: "A origem entra quando a pessoa escolhe o aeroporto." },
  { origins: ["GYN"], destinations: ["LIS"], caption: "O destino desenha a rota principal." },
  { origins: ["GYN", "BSB"], destinations: ["LIS", "OPO"], caption: "Alternativas escolhidas aparecem em tracejado. Aeroportos não escolhidos ficam de fora." },
];

export function HomeShowcase({ signedIn }: { signedIn: boolean }) {
  const [step, setStep] = useState(0);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMotion(!media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!motion) return;
    const timer = window.setInterval(() => setStep((current) => (current + 1) % STEPS.length), 1700);
    return () => window.clearInterval(timer);
  }, [motion]);

  const frame = motion ? STEPS[step] : STEPS[STEPS.length - 1];
  const model = buildRouteMapModel({ airports: AIRPORTS, origins: frame.origins, destinations: frame.destinations });

  return (
    <section className="home-hero">
      <div className="hero">
        <p className="eyebrow">Pesquisa de mercado</p>
        <h1>Compare tarifas das companhias, no mundo inteiro.</h1>
        <p className="lede">
          A Abud Flights acompanha o preço direto nas companhias. Você escolhe a rota, vê o histórico e recebe alertas. Quando quiser seguir, abre o link daquela viagem.
        </p>
        <div className="row">
          <Link className="btn" href={signedIn ? "/busca" : "/criar-conta"}>
            {signedIn ? "Nova busca" : "Criar conta"}
          </Link>
          <Link className="btn btn-secondary" href={signedIn ? "/monitoramentos" : "/entrar"}>
            {signedIn ? "Meus monitoramentos" : "Entrar"}
          </Link>
        </div>
        <ol className="home-steps">
          <li>Escolha origem, destino e as alternativas.</li>
          <li>Compare o que a rodada consultou.</li>
          <li>Acompanhe a cada 12 horas.</li>
          <li>Abra o Google Voos com a rota e as datas.</li>
        </ol>
      </div>
      <aside className="card stack hero-map">
        <p className="eyebrow">Animação da rota</p>
        <h2>Como o mapa se preenche</h2>
        <p className="muted">{frame.caption} Este exemplo não é uma tarifa ao vivo.</p>
        <RouteMap model={model} />
      </aside>
    </section>
  );
}
