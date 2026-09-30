import { CELLS, clashes, colOf, conflicts, PEERS, rowOf } from "@sudoku-race/shared";
import type { Progress } from "./storage.js";

/**
 * État d'une partie côté client. La solution n'est jamais connue : une
 * « erreur » est un chiffre posé en doublon dans sa ligne, sa colonne ou sa
 * région. Elle ne compte (+10 s) que si la vérification automatique est
 * active, c'est-à-dire quand elle est signalée ; chaque erreur (case, chiffre)
 * ne compte qu'une fois, et activer la vérification compte les doublons déjà
 * présents.
 */
export interface GameState {
  values: number[];
  notes: number[];
  mistakes: number;
  flagged: string[];
  history: { values: number[]; notes: number[] }[];
  selected: number | null;
  notesMode: boolean;
}

export type GameAction =
  | { type: "select"; i: number | null }
  | { type: "move"; dr: number; dc: number }
  | { type: "input"; d: number; note?: boolean; check: boolean }
  | { type: "erase" }
  | { type: "undo" }
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
    flagged: saved?.flagged ?? [],
    history: [],
    selected: null,
    notesMode: false,
  };
}

export function noteDigits(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

function snapshot(s: GameState): GameState["history"] {
  const h = [...s.history, { values: s.values, notes: s.notes }];
  return h.length > MAX_HISTORY ? h.slice(h.length - MAX_HISTORY) : h;
}

/** Compte les doublons visibles pas encore comptés. */
function flagConflicts(givens: string, values: number[], flagged: string[], only?: number): { mistakes: number; flagged: string[] } {
  const seen = new Set(flagged);
  let added = 0;
  const cells = only !== undefined ? (clashes(values, only) ? [only] : []) : [...conflicts(values)];
  for (const i of cells) {
    if (givens[i] !== "0") continue;
    const key = `${i}:${values[i]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    added++;
  }
  return { mistakes: added, flagged: [...seen] };
}

export function reduce(givens: string, s: GameState, a: GameAction): GameState {
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
        return { ...s, notes, history: snapshot(s) };
      }
      if (s.values[i] === a.d) return s;
      const values = [...s.values];
      const notes = [...s.notes];
      values[i] = a.d;
      notes[i] = 0;
      // le chiffre posé disparaît des notes de ses voisines
      for (const p of PEERS[i]!) notes[p]! &= ~bit(a.d);
      let { mistakes, flagged } = s;
      if (a.check) {
        const f = flagConflicts(givens, values, flagged, i);
        mistakes += f.mistakes;
        flagged = f.flagged;
      }
      return { ...s, values, notes, mistakes, flagged, history: snapshot(s) };
    }
    case "erase": {
      if (!editable || (!s.values[i] && !s.notes[i])) return s;
      const values = [...s.values];
      const notes = [...s.notes];
      values[i] = 0;
      notes[i] = 0;
      return { ...s, values, notes, history: snapshot(s) };
    }
    case "undo": {
      const last = s.history.at(-1);
      if (!last) return s;
      // annuler ne rend pas les secondes de pénalité
      return { ...s, values: last.values, notes: last.notes, history: s.history.slice(0, -1) };
    }
    case "enableCheck": {
      const f = flagConflicts(givens, s.values, s.flagged);
      return f.mistakes ? { ...s, mistakes: s.mistakes + f.mistakes, flagged: f.flagged } : s;
    }
  }
}
