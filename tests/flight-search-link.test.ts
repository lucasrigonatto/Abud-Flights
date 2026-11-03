import { describe, expect, it } from "vitest";
import { googleFlightsUrl } from "../src/domain/flight-search-link";

function readVarint(bytes: Uint8Array, index: number): [number, number] {
  let value = 0;
  let shift = 0;
  while (index < bytes.length) {
    const byte = bytes[index];
    index += 1;
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return [value, index];
    shift += 7;
  }
  return [value, index];
}

function stringsIn(token: string): string[] {
  const bytes = Buffer.from(token, "base64url");
  const found: string[] = [];
  const walk = (buf: Uint8Array) => {
    let index = 0;
    while (index < buf.length) {
      const [key, next] = readVarint(buf, index);
      index = next;
      const wire = key & 7;
      if (wire === 0) {
        const [, after] = readVarint(buf, index);
        index = after;
      } else if (wire === 2) {
        const [length, after] = readVarint(buf, index);
        index = after;
        const chunk = buf.subarray(index, index + length);
        index += length;
        const text = Buffer.from(chunk).toString("utf8");
        if (/^[\x20-\x7e]+$/.test(text)) found.push(text);
        else walk(chunk);
      } else break;
    }
  };
  walk(bytes);
  return found;
}

describe("link para a passagem no Google Voos", () => {
  it("abre a página de reserva com os trechos da ida e da volta", () => {
    const url = googleFlightsUrl({
      origin: "GRU",
      destination: "BKK",
      departDate: "2026-12-13",
      returnDate: "2026-12-25",
      currency: "BRL",
      adults: 1,
      segments: [
        { origin: "GRU", destination: "DOH", departLocal: "2026-12-13T02:10:00", flightNumber: "QR774" },
        { origin: "DOH", destination: "KUL", departLocal: "2026-12-14T09:00:00", flightNumber: "MH161" },
        { origin: "KUL", destination: "BKK", departLocal: "2026-12-14T18:00:00", flightNumber: "MH774" },
        { origin: "BKK", destination: "KUL", departLocal: "2026-12-25T14:15:00", flightNumber: "MH789" },
        { origin: "KUL", destination: "DOH", departLocal: "2026-12-25T22:00:00", flightNumber: "MH160" },
        { origin: "DOH", destination: "GRU", departLocal: "2026-12-26T08:00:00", flightNumber: "QR779" },
      ],
    });
    expect(url?.startsWith("https://www.google.com/travel/flights/booking?tfs=")).toBe(true);
    expect(url).toContain("hl=pt-BR");
    expect(url).toContain("curr=BRL");
    expect(url).not.toContain("#flt=");
    const token = new URL(url ?? "").searchParams.get("tfs") ?? "";
    const text = stringsIn(token);
    expect(text).toEqual(expect.arrayContaining(["2026-12-13", "GRU", "DOH", "QR", "774", "MH", "161", "BKK", "2026-12-25", "789", "160", "2026-12-26", "779"]));
  });

  it("não inventa a volta numa passagem de somente ida", () => {
    const url = googleFlightsUrl({
      origin: "NRT",
      destination: "SYD",
      departDate: "2027-04-10",
      returnDate: null,
      currency: "USD",
      segments: [{ origin: "NRT", destination: "SYD", departLocal: "2027-04-10T10:00:00", flightNumber: "NH881" }],
    });
    expect(url?.startsWith("https://www.google.com/travel/flights/booking?tfs=")).toBe(true);
    const token = new URL(url ?? "").searchParams.get("tfs") ?? "";
    const dates = stringsIn(token).filter((item) => item.startsWith("2027-"));
    expect(dates.every((date) => date === "2027-04-10")).toBe(true);
    expect(dates.length).toBeGreaterThan(0);
  });

  it("sem trechos, abre a busca da rota em vez da página inicial", () => {
    const url = googleFlightsUrl({
      origin: "gyn",
      destination: "lis",
      departDate: "2026-12-13",
      returnDate: "2026-12-25",
      currency: "brl",
    });
    expect(url?.startsWith("https://www.google.com/travel/flights/search?tfs=")).toBe(true);
    expect(url).not.toContain("#flt=");
    const token = new URL(url ?? "").searchParams.get("tfs") ?? "";
    expect(stringsIn(token)).toEqual(expect.arrayContaining(["2026-12-13", "GYN", "LIS", "2026-12-25"]));
  });

  it("não monta um link com aeroporto ou data inválidos", () => {
    expect(googleFlightsUrl({ origin: "GY", destination: "LIS", departDate: "2026-12-13", returnDate: null, currency: "BRL" })).toBeNull();
    expect(googleFlightsUrl({ origin: "GYN", destination: "LIS", departDate: "13/12/2026", returnDate: null, currency: "BRL" })).toBeNull();
  });
});
