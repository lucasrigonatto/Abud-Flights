const SCALE: Record<string, number> = {
  BRL: 2,
  EUR: 2,
  USD: 2,
};

const SYMBOL: Record<string, string> = {
  BRL: "R$",
  EUR: "€",
  USD: "US$",
};

export function scaleOf(currency: string): number | null {
  return SCALE[currency] ?? null;
}

export function divRound(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  const sign = numerator < 0 ? -1 : 1;
  const abs = Math.abs(numerator);
  return sign * Math.floor((abs + Math.floor(denominator / 2)) / denominator);
}

export function formatMoney(amountMinor: number, currency: string): string {
  const scale = SCALE[currency];
  if (scale === undefined) return `${amountMinor} ${currency}`;
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  const factor = 10 ** scale;
  const whole = Math.floor(absolute / factor);
  const fraction = (absolute % factor).toString().padStart(scale, "0");
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const number = scale > 0 ? `${grouped},${fraction}` : grouped;
  const symbol = SYMBOL[currency] ?? currency;
  return `${negative ? "-" : ""}${symbol} ${number}`;
}

export function minorToInput(amountMinor: number, currency: string): string {
  const scale = SCALE[currency] ?? 2;
  const factor = 10 ** scale;
  const whole = Math.floor(Math.abs(amountMinor) / factor);
  const fraction = (Math.abs(amountMinor) % factor).toString().padStart(scale, "0");
  return scale > 0 ? `${whole},${fraction}` : String(whole);
}

export function parseMoneyToMinor(input: string, currency: string): number | null {
  const scale = SCALE[currency];
  if (scale === undefined) return null;
  let normalized = input.trim().replace(/\s/g, "");
  if (!normalized) return null;
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }
  if (!/^\d+(\.\d{1,4})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > scale) return null;
  const padded = (fraction + "0".repeat(scale)).slice(0, scale);
  const minor = Number(whole) * 10 ** scale + Number(padded || "0");
  if (!Number.isSafeInteger(minor)) return null;
  return minor;
}
