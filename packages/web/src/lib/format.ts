/** 6:42, 1:02:03 */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(locale: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(opts);
  let f = cache.get(key);
  if (!f) cache.set(key, (f = new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" })));
  return f;
}
const asDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** « jeudi 1 octobre », « Thursday 1 October » */
export function formatDay(day: string, locale: string): string {
  return fmt(locale, { weekday: "long", day: "numeric", month: "long" }).format(asDate(day));
}

/** « 1 oct. » */
export function formatShortDay(day: string, locale: string): string {
  return fmt(locale, { day: "numeric", month: "short" }).format(asDate(day));
}


/** « jeu. », « Thu » */
export function formatWeekday(day: string, locale: string): string {
  return fmt(locale, { weekday: "short" }).format(asDate(day));
}
