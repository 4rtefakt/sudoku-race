/**
 * Saison hebdomadaire (lundi → dimanche) : chaque jour, les joueurs qui ont
 * fini la grille sont classés au temps ; 3 points au premier, 2 au deuxième,
 * 1 à tous les autres qui ont fini. Chacun voit la saison de son propre
 * cercle (lui + ses amis), les amitiés étant à sens unique.
 */
export const PENALTY_MS = 10_000;
const POINTS = [3, 2] as const;

export function pointsForRank(rank: number): number {
  return POINTS[rank - 1] ?? 1;
}

/** Classement « 1, 1, 3 » : les ex æquo partagent le rang. */
export function rankByTime<T extends { timeMs: number }>(entries: readonly T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => a.timeMs - b.timeMs);
  return sorted.map((e, i) => {
    let first = i;
    while (first > 0 && sorted[first - 1]!.timeMs === e.timeMs) first--;
    return { ...e, rank: first + 1 };
  });
}

export interface SeasonScore<P> {
  player: P;
  day: string;
  timeMs: number;
}

/** Points par joueur et par jour pour les jours donnés (null = pas fini ce jour-là). */
export function seasonTable<P>(days: readonly string[], scores: readonly SeasonScore<P>[]): Map<P, { total: number; perDay: (number | null)[] }> {
  const table = new Map<P, { total: number; perDay: (number | null)[] }>();
  const row = (p: P) => {
    let r = table.get(p);
    if (!r) table.set(p, (r = { total: 0, perDay: days.map(() => null) }));
    return r;
  };
  days.forEach((day, d) => {
    for (const e of rankByTime(scores.filter((s) => s.day === day))) {
      const r = row(e.player);
      const pts = pointsForRank(e.rank);
      r.perDay[d] = pts;
      r.total += pts;
    }
  });
  return table;
}
