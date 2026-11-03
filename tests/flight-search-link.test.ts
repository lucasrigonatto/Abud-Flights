import { describe, expect, it } from "vitest";
import { googleFlightsUrl } from "../src/domain/flight-search-link";

describe("link para a busca ao vivo", () => {
  it("abre o Google Voos com ida e volta, origem, destino e moeda", () => {
    const url = googleFlightsUrl({
      origin: "gyn",
      destination: "lis",
      departDate: "2026-12-13",
      returnDate: "2026-12-25",
      currency: "brl",
    });
    expect(url).toBe("https://www.google.com/travel/flights?hl=pt-BR&curr=BRL#flt=GYN.LIS.2026-12-13*LIS.GYN.2026-12-25");
  });

  it("abre somente ida sem inventar a volta", () => {
    const url = googleFlightsUrl({
      origin: "NRT",
      destination: "SYD",
      departDate: "2027-04-10",
      returnDate: null,
      currency: "USD",
    });
    expect(url).toBe("https://www.google.com/travel/flights?hl=pt-BR&curr=USD#flt=NRT.SYD.2027-04-10");
  });

  it("não monta um link com aeroporto ou data inválidos", () => {
    expect(
      googleFlightsUrl({ origin: "GY", destination: "LIS", departDate: "2026-12-13", returnDate: null, currency: "BRL" }),
    ).toBeNull();
    expect(
      googleFlightsUrl({ origin: "GYN", destination: "LIS", departDate: "13/12/2026", returnDate: null, currency: "BRL" }),
    ).toBeNull();
  });
});
