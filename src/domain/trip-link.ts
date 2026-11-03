import type { PriceKind } from "./provider";

export type TripLink =
  | {
      kind: "source";
      href: string;
      label: string;
      note: string;
      external: true;
    }
  | {
      kind: "demonstration";
      href: string;
      label: string;
      note: string;
      external: false;
    }
  | {
      kind: "unavailable";
      href: null;
      label: null;
      note: string;
      external: false;
    };

const DEMONSTRATION_LABEL = "Link de demonstração";
const DEMONSTRATION_NOTE = "Não é o site da companhia nem uma página de compra.";
const SOURCE_LABEL = "Abrir o link da viagem";
const SOURCE_NOTE = "Endereço da companhia ou da fonte. A Abud Flights não vende a passagem.";
const MISSING_NOTE = "A fonte não informou o link desta viagem.";
const DEMO_FALLBACK = "/ofertas-simuladas/sem-url-real";

function absoluteHttp(link: string): boolean {
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function describeTripLink(link: string | null, priceKind: PriceKind): TripLink {
  if (priceKind !== "DEMONSTRATION" && link && absoluteHttp(link)) {
    return {
      kind: "source",
      href: link,
      label: SOURCE_LABEL,
      note: priceKind === "LIVE_INDICATIVE" ? `Preço indicativo. ${SOURCE_NOTE}` : SOURCE_NOTE,
      external: true,
    };
  }
  if (priceKind === "DEMONSTRATION") {
    const href = link && link.startsWith("/ofertas-simuladas/") ? link : DEMO_FALLBACK;
    return {
      kind: "demonstration",
      href,
      label: DEMONSTRATION_LABEL,
      note: DEMONSTRATION_NOTE,
      external: false,
    };
  }
  return { kind: "unavailable", href: null, label: null, note: MISSING_NOTE, external: false };
}
