export function shiftDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function flexDates(center: string, flexDays: number): string[] {
  const dates: string[] = [];
  for (let offset = -flexDays; offset <= flexDays; offset += 1) {
    dates.push(shiftDate(center, offset));
  }
  return dates;
}

export function isoDateInTimeZone(date: Date, timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatCivilDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDateTime(date: Date, timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatConsultation(date: Date): string {
  return `Consultado em ${formatDateTime(date)}`;
}

export function endOfSaoPauloDay(isoDate: string): Date {
  return new Date(`${shiftDate(isoDate, 1)}T00:00:00.000-03:00`);
}

export function inclusiveUntilDate(monitorUntil: Date): string {
  return isoDateInTimeZone(new Date(monitorUntil.getTime() - 1000));
}

export function saoPauloMonth(now: Date): { start: Date; daysElapsed: number; daysInMonth: number } {
  const iso = isoDateInTimeZone(now);
  const [year, month, day] = iso.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: new Date(`${iso.slice(0, 7)}-01T00:00:00.000-03:00`),
    daysElapsed: day,
    daysInMonth,
  };
}

export function utcDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function isoFromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
