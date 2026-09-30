import { boxOf, CELLS, colOf, rowOf } from "@sudoku-race/shared";
import { shuffle, type Rng } from "./rng.js";

/**
 * Solveur par retour arrière sur masques de bits (case la plus contrainte
 * d'abord). Sert à compter les solutions (unicité) et à remplir une grille.
 */
const ALL = 0x3fe; // bits 1..9
const ROW = Array.from({ length: CELLS }, (_, i) => rowOf(i));
const COL = Array.from({ length: CELLS }, (_, i) => colOf(i));
const BOX = Array.from({ length: CELLS }, (_, i) => boxOf(i));

export function popcount(m: number): number {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d);
  return out;
}

interface State {
  v: number[];
  rows: number[];
  cols: number[];
  boxes: number[];
}

function init(values: readonly number[]): State | null {
  const s: State = { v: [...values], rows: new Array(9).fill(0), cols: new Array(9).fill(0), boxes: new Array(9).fill(0) };
  for (let i = 0; i < CELLS; i++) {
    const d = s.v[i]!;
    if (!d) continue;
    const b = 1 << d;
    if (s.rows[ROW[i]!]! & b || s.cols[COL[i]!]! & b || s.boxes[BOX[i]!]! & b) return null;
    s.rows[ROW[i]!]! |= b;
    s.cols[COL[i]!]! |= b;
    s.boxes[BOX[i]!]! |= b;
  }
  return s;
}

/** Case vide au moins de candidats ; -1 si la grille est pleine, -2 si une case n'a plus de candidat. */
function pickCell(s: State): { i: number; mask: number } {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < CELLS; i++) {
    if (s.v[i]) continue;
    const mask = ALL & ~(s.rows[ROW[i]!]! | s.cols[COL[i]!]! | s.boxes[BOX[i]!]!);
    const n = popcount(mask);
    if (n === 0) return { i: -2, mask: 0 };
    if (n < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = n;
      if (n === 1) break;
    }
  }
  return { i: best, mask: bestMask };
}

function search(s: State, limit: number, found: { n: number; first: number[] | null }, rng?: Rng): void {
  const { i, mask } = pickCell(s);
  if (i === -2) return;
  if (i === -1) {
    found.n++;
    if (!found.first) found.first = [...s.v];
    return;
  }
  const digits = digitsOf(mask);
  if (rng) shuffle(digits, rng);
  for (const d of digits) {
    const b = 1 << d;
    s.v[i] = d;
    s.rows[ROW[i]!]! |= b;
    s.cols[COL[i]!]! |= b;
    s.boxes[BOX[i]!]! |= b;
    search(s, limit, found, rng);
    s.v[i] = 0;
    s.rows[ROW[i]!]! &= ~b;
    s.cols[COL[i]!]! &= ~b;
    s.boxes[BOX[i]!]! &= ~b;
    if (found.n >= limit) return;
  }
}

/** Nombre de solutions, arrêté à `limit` (2 suffit pour tester l'unicité). */
export function countSolutions(values: readonly number[], limit = 2): number {
  const s = init(values);
  if (!s) return 0;
  const found = { n: 0, first: null as number[] | null };
  search(s, limit, found);
  return found.n;
}

export function solve(values: readonly number[]): number[] | null {
  const s = init(values);
  if (!s) return null;
  const found = { n: 0, first: null as number[] | null };
  search(s, 1, found);
  return found.first;
}

/** Grille complète tirée au hasard. */
export function randomSolution(rng: Rng): number[] {
  const s = init(new Array(CELLS).fill(0))!;
  const found = { n: 0, first: null as number[] | null };
  search(s, 1, found, rng);
  return found.first!;
}
