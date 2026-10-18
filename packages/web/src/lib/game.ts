import { CELLS, clashes, colOf, conflicts, PEERS, rowOf } from "@sudoku-race/shared";
import type { Progress, Snapshot } from "./storage.js";

/**
 * État d'une partie côté client. Une « erreur » est un chiffre posé en
 * doublon dans sa ligne, sa colonne ou sa région (+10 s), ou, à défaut, un
 * chiffre qui n'est pas celui de la solution (+30 s) : si les deux
 * s'appliquent, c'est la pénalité la plus courte. Elle ne compte que si la
 * vérification automatique est active, c'est-à-dire quand elle est signalée ;
 * chaque erreur (case, chiffre) ne compte qu'une fois, et activer la
 * vérification compte les erreurs déjà présentes.
 */
export interface GameState {
  values: number[];
  notes: number[];
  /** doublons signalés */
  mistakes: number;
  /** chiffres faux signalés (hors doublons) */
  wrong: number;
  flagged: string[];
  /** états précédents (annuler) et annulés (rétablir), gardés avec la partie */
  history: Snapshot[];
  future: Snapshot[];
  selected: number | null;
  notesMode: boolean;
}

export type GameAction =
  | { type: "select"; i: number | null }
  | { type: "move"; dr: number; dc: number }
  | { type: "input"; d: number; note?: boolean; check: boolean }
  | { type: "erase" }
  | { type: "undo"; check: boolean }
  | { type: "redo"; check: boolean }
  | { type: "toggleNotes" }
  | { type: "enableCheck" };

const MAX_HISTORY = 300;
const bit = (d: number) => 1 << d;

export function initialState(givens: string, saved: Progress | null): GameState {
  const values = saved?.values ?? Array.from(givens, (ch) => ch.charCodeAt(0) - 48);
  // les chiffres donnés priment toujours sur une sauvegarde abîmée
  for (let i = 0; i < CELLS; i++) if (givens[i] !== "0") values[i] = givens.charCodeAt(i) - 48;
  return {
    values,
    notes: saved?.notes ?? new Array<number>(CELLS).fill(0),
    mistakes: saved?.mistakes ?? 0,
    wrong: saved?.wrong ?? 0,
    flagged: saved?.flagged ?? [],
    history: saved?.history ?? [],
    future: saved?.future ?? [],
    selected: null,
    notesMode: false,
  };
}

export function noteDigits(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

function push(stack: Snapshot[], s: GameState): Snapshot[] {
  const h = [...stack, { values: s.values, notes: s.notes }];
  return h.length > MAX_HISTORY ? h.slice(h.length - MAX_HISTORY) : h;
}

/** Nouvelle modification : l'état courant rejoint l'historique et on ne peut plus rétablir. */
function edited(s: GameState, next: Partial<GameState>): GameState {
  return { ...s, ...next, history: push(s.history, s), future: [] };
}

/** Annuler ou rétablir : erreurs réapparues signalées si la vérification est active. */
function restore(givens: string, solution: string | null, s: GameState, to: Snapshot, check: boolean, history: Snapshot[], future: Snapshot[]): GameState {
  const next = { ...s, values: to.values, notes: to.notes, history, future };
  if (!check) return next;
  const f = flagErrors(givens, solution, to.values, s.flagged);
  return f.mistakes || f.wrong ? { ...next, mistakes: s.mistakes + f.mistakes, wrong: s.wrong + f.wrong, flagged: f.flagged } : next;
}

/** Chiffre posé différent de la solution (sans solution connue : jamais). */
export function isWrong(solution: string | null, values: readonly number[], i: number): boolean {
  return !!solution && values[i]! > 0 && values[i] !== solution.charCodeAt(i) - 48;
}

/** Cases posées dont le chiffre n'est pas celui de la solution. */
export function wrongCells(givens: string, solution: string | null, values: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < CELLS; i++) if (givens[i] === "0" && isWrong(solution, values, i)) out.add(i);
  return out;
}

/** Compte les erreurs visibles pas encore comptées : doublon d'abord, sinon chiffre faux. */
function flagErrors(givens: string, solution: string | null, values: number[], flagged: string[], only?: number): { mistakes: number; wrong: number; flagged: string[] } {
  const seen = new Set(flagged);
  let mistakes = 0;
  let wrong = 0;
  const dup = only !== undefined ? null : conflicts(values);
  const cells = only !== undefined ? [only] : Array.from({ length: CELLS }, (_, i) => i);
  for (const i of cells) {
    if (givens[i] !== "0" || !values[i]) continue;
    const isDup = dup ? dup.has(i) : clashes(values, i);
    if (!isDup && !isWrong(solution, values, i)) continue;
    const key = `${i}:${values[i]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isDup) mistakes++;
    else wrong++;
  }
  return { mistakes, wrong, flagged: [...seen] };
}

export function reduce(givens: string, solution: string | null, s: GameState, a: GameAction): GameState {
  const i = s.selected;
  const editable = i !== null && givens[i] === "0";
  switch (a.type) {
    case "select":
      return { ...s, selected: a.i };
    case "move": {
      const from = i ?? 40;
      const r = (rowOf(from) + a.dr + 9) % 9;
      const c = (colOf(from) + a.dc + 9) % 9;
      return { ...s, selected: i === null ? 40 : r * 9 + c };
    }
    case "toggleNotes":
      return { ...s, notesMode: !s.notesMode };
    case "input": {
      if (!editable || a.d < 1 || a.d > 9) return s;
      if (a.note || s.notesMode) {
        if (s.values[i]) return s;
        const notes = [...s.notes];
        notes[i]! ^= bit(a.d);
        return edited(s, { notes });
      }
      if (s.values[i] === a.d) return s;
      const values = [...s.values];
      const notes = [...s.notes];
      values[i] = a.d;
      notes[i] = 0;
      // le chiffre posé disparaît des notes de ses voisines
      for (const p of PEERS[i]!) notes[p]! &= ~bit(a.d);
      let { mistakes, wrong, flagged } = s;
      if (a.check) {
        const f = flagErrors(givens, solution, values, flagged, i);
        mistakes += f.mistakes;
        wrong += f.wrong;
        flagged = f.flagged;
      }
      return edited(s, { values, notes, mistakes, wrong, flagged });
    }
    case "erase": {
      if (!editable || (!s.values[i] && !s.notes[i])) return s;
      const values = [...s.values];
      const notes = [...s.notes];
      values[i] = 0;
      notes[i] = 0;
      return edited(s, { values, notes });
    }
    case "undo": {
      const last = s.history.at(-1);
      if (!last) return s;
      // annuler ne rend pas les secondes de pénalité
      return restore(givens, solution, s, last, a.check, s.history.slice(0, -1), push(s.future, s));
    }
    case "redo": {
      const next = s.future.at(-1);
      if (!next) return s;
      return restore(givens, solution, s, next, a.check, push(s.history, s), s.future.slice(0, -1));
    }
    case "enableCheck": {
      const f = flagErrors(givens, solution, s.values, s.flagged);
      return f.mistakes || f.wrong ? { ...s, mistakes: s.mistakes + f.mistakes, wrong: s.wrong + f.wrong, flagged: f.flagged } : s;
    }
  }
}
