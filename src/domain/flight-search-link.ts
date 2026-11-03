const IATA = /^[A-Z]{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function googleFlightsUrl(input: {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
  currency: string;
}): string | null {
  const origin = input.origin.trim().toUpperCase();
  const destination = input.destination.trim().toUpperCase();
  const departDate = input.departDate.trim();
  const returnDate = input.returnDate?.trim() ?? "";
  const currency = input.currency.trim().toUpperCase();
  if (!IATA.test(origin) || !IATA.test(destination) || !ISO_DATE.test(departDate)) return null;
  if (!/^[A-Z]{3}$/.test(currency)) return null;

  const outbound = `${origin}.${destination}.${departDate}`;
  const route = returnDate && ISO_DATE.test(returnDate) ? `${outbound}*${destination}.${origin}.${returnDate}` : outbound;
  const params = new URLSearchParams({ hl: "pt-BR", curr: currency });
  return `https://www.google.com/travel/flights?${params.toString()}#flt=${route}`;
}
