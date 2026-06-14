export const BRUSSELS_TIME_ZONE = "Europe/Brussels";

const pad2 = (n: number) => String(n).padStart(2, "0");

export function getBrusselsDateParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BRUSSELS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

export function todayBrusselsISO(date: Date = new Date()) {
  const p = getBrusselsDateParts(date);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function addMonthsYM(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1, 12));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
}

export function monthStartISO(year: number, month: number) {
  return `${year}-${pad2(month)}-01`;
}

export function monthEndISO(year: number, month: number) {
  return `${year}-${pad2(month)}-${pad2(daysInMonth(year, month))}`;
}

export function addDaysISO(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function brusselsWallTimeDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
) {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const p = getBrusselsDateParts(new Date(naiveUtc));
  const brusselsAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, millisecond);
  const offsetMs = brusselsAsUtc - naiveUtc;
  return new Date(naiveUtc - offsetMs);
}

export function brusselsDeadlineDate(year: number, month: number, lockDay: number) {
  return brusselsWallTimeDate(year, month, lockDay, 23, 59, 59, 999);
}

export function formatBrusselsMonthLabel(year: number, month: number) {
  const date = brusselsWallTimeDate(year, month, 1, 12);
  return date.toLocaleDateString("fr-FR", {
    timeZone: BRUSSELS_TIME_ZONE,
    month: "long",
    year: "numeric",
  });
}

export function formatBrusselsDate(date: Date | string, options: Intl.DateTimeFormatOptions) {
  return new Date(date).toLocaleDateString("fr-FR", {
    timeZone: BRUSSELS_TIME_ZONE,
    ...options,
  });
}

export function formatBrusselsTime(date: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(date).toLocaleTimeString("fr-FR", {
    timeZone: BRUSSELS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

export function formatBrusselsDateTime(date: Date | string) {
  return `${formatBrusselsDate(date, { day: "2-digit", month: "long", year: "numeric" })} à ${formatBrusselsTime(date)}`;
}

export function formatBrusselsShortDayMonth(date: Date | string) {
  return formatBrusselsDate(date, { day: "2-digit", month: "short" });
}

export function formatBrusselsDeadlineLabel(date: Date | string) {
  return `${formatBrusselsDate(date, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })} à ${formatBrusselsTime(date).replace(":", "h")}`;
}