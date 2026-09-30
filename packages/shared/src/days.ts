/**
 * Jours de jeu : une grille par jour, clé « AAAA-MM-JJ » à l'heure de Paris.
 * L'arithmétique se fait en UTC sur la date seule, sans heure ni fuseau.
 */
export const TIME_ZONE = "Europe/Paris";

/** Premier jour du calendrier : grille n° 1. */
export const FIRST_DAY = "2026-09-28";

export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const fmtCache = new Map<string, Intl.DateTimeFormat>();

/** Jour courant (ou de `date`) dans le fuseau donné, au format AAAA-MM-JJ. */
export function dayKey(date: Date = new Date(), timeZone = TIME_ZONE): string {
  let fmt = fmtCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    fmtCache.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isDayKey(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function toUtc(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  const d = toUtc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Nombre de jours de `a` à `b` (positif si b est après a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = lundi … 6 = dimanche. */
export function weekday(day: string): number {
  return (toUtc(day).getUTCDay() + 6) % 7;
}

/** Lundi de la semaine qui contient `day`. */
export function weekStart(day: string): string {
  return addDays(day, -weekday(day));
}

/** Les sept jours (lundi → dimanche) de la semaine qui contient `day`. */
export function weekDays(day: string): string[] {
  const monday = weekStart(day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Difficulté du jour : lundi-mardi facile, mercredi-jeudi moyen, vendredi-samedi difficile, dimanche expert. */
export function difficultyForDay(day: string): Difficulty {
  return (["easy", "easy", "medium", "medium", "hard", "hard", "expert"] as const)[weekday(day)]!;
}

/** Numéro de la grille (1 pour FIRST_DAY). */
export function puzzleNumber(day: string): number {
  return daysBetween(FIRST_DAY, day) + 1;
}
