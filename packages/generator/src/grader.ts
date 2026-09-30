import { CELLS, colOf, PEERS, rowOf, boxOf, UNITS } from "@sudoku-race/shared";
import { digitsOf, popcount } from "./solver.js";

/**
 * Résolution « à la main » : on applique toujours la technique la plus simple
 * qui fait avancer la grille, et la difficulté est celle de la plus dure dont
 * on a eu besoin. Une grille que ces techniques ne suffisent pas à finir est
 * jugée trop dure (niveau null) : elle demanderait des essais-erreurs.
 *
 *   1 facile     singletons nus et cachés
 *   2 moyen      candidats verrouillés, paires nues et cachées
 *   3 difficile  triplets nus et cachés, X-wing
 *   4 expert     quadruplets nus et cachés, XY-wing, swordfish
 */
export type Level = 1 | 2 | 3 | 4;

const ALL = 0x3fe;
const bit = (d: number) => 1 << d;

class Board {
  v: number[];
  c: number[];
  constructor(values: readonly number[]) {
    this.v = [...values];
    this.c = new Array<number>(CELLS).fill(0);
    for (let i = 0; i < CELLS; i++) {
      if (this.v[i]) continue;
      let m = ALL;
      for (const p of PEERS[i]!) if (this.v[p]) m &= ~bit(this.v[p]!);
      this.c[i] = m;
    }
  }
  place(i: number, d: number) {
    this.v[i] = d;
    this.c[i] = 0;
    for (const p of PEERS[i]!) this.c[p]! &= ~bit(d);
  }
  /** Retire `mask` des candidats de i ; vrai si quelque chose a changé. */
  drop(i: number, mask: number): boolean {
    if (this.v[i] || !(this.c[i]! & mask)) return false;
    this.c[i]! &= ~mask;
    return true;
  }
}

function* combos<T>(items: readonly T[], k: number, start = 0, acc: T[] = []): Generator<T[]> {
  if (acc.length === k) {
    yield acc;
    return;
  }
  for (let i = start; i <= items.length - (k - acc.length); i++) {
    acc.push(items[i]!);
    yield* combos(items, k, i + 1, acc);
    acc.pop();
  }
}

function nakedSingle(b: Board): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (!b.v[i] && popcount(b.c[i]!) === 1) {
      b.place(i, digitsOf(b.c[i]!)[0]!);
      return true;
    }
  }
  return false;
}

function hiddenSingle(b: Board): boolean {
  for (const u of UNITS) {
    for (let d = 1; d <= 9; d++) {
      let at = -1;
      let n = 0;
      for (const i of u) {
        if (b.v[i] === d) {
          n = -1;
          break;
        }
        if (b.c[i]! & bit(d)) {
          at = i;
          n++;
        }
      }
      if (n === 1) {
        b.place(at, d);
        return true;
      }
    }
  }
  return false;
}

/** Pointage (région → ligne/colonne) et revendication (ligne/colonne → région). */
function lockedCandidates(b: Board): boolean {
  for (const u of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const cells = u.filter((i) => b.c[i]! & bit(d));
      if (cells.length < 2) continue;
      const targets: (readonly number[])[] = [];
      if (cells.every((i) => rowOf(i) === rowOf(cells[0]!))) targets.push(UNITS[rowOf(cells[0]!)]!);
      if (cells.every((i) => colOf(i) === colOf(cells[0]!))) targets.push(UNITS[9 + colOf(cells[0]!)]!);
      if (cells.every((i) => boxOf(i) === boxOf(cells[0]!))) targets.push(UNITS[18 + boxOf(cells[0]!)]!);
      let changed = false;
      for (const t of targets) {
        if (t === u) continue;
        for (const i of t) if (!u.includes(i)) changed = b.drop(i, bit(d)) || changed;
      }
      if (changed) return true;
    }
  }
  return false;
}

function nakedSubset(k: number) {
  return (b: Board): boolean => {
    for (const u of UNITS) {
      const empty = u.filter((i) => !b.v[i] && popcount(b.c[i]!) <= k);
      if (empty.length < k) continue;
      for (const set of combos(empty, k)) {
        let union = 0;
        for (const i of set) union |= b.c[i]!;
        if (popcount(union) !== k) continue;
        let changed = false;
        for (const i of u) if (!set.includes(i)) changed = b.drop(i, union) || changed;
        if (changed) return true;
      }
    }
    return false;
  };
}

function hiddenSubset(k: number) {
  return (b: Board): boolean => {
    for (const u of UNITS) {
      const placed = new Set(u.map((i) => b.v[i]));
      const digits: number[] = [];
      const where = new Map<number, number[]>();
      for (let d = 1; d <= 9; d++) {
        if (placed.has(d)) continue;
        const cells = u.filter((i) => b.c[i]! & bit(d));
        if (cells.length >= 1 && cells.length <= k) {
          digits.push(d);
          where.set(d, cells);
        }
      }
      if (digits.length < k) continue;
      for (const set of combos(digits, k)) {
        const cells = new Set(set.flatMap((d) => where.get(d)!));
        if (cells.size !== k) continue;
        let keep = 0;
        for (const d of set) keep |= bit(d);
        let changed = false;
        for (const i of cells) changed = b.drop(i, ALL & ~keep) || changed;
        if (changed) return true;
      }
    }
    return false;
  };
}

/** X-wing (k = 2) et swordfish (k = 3), sur les lignes puis sur les colonnes. */
function fish(k: number) {
  return (b: Board): boolean => {
    for (let d = 1; d <= 9; d++) {
      for (const byRow of [true, false]) {
        const at = (line: number, pos: number) => (byRow ? line * 9 + pos : pos * 9 + line);
        const lines: { line: number; mask: number }[] = [];
        for (let line = 0; line < 9; line++) {
          let mask = 0;
          for (let pos = 0; pos < 9; pos++) if (b.c[at(line, pos)]! & bit(d)) mask |= 1 << pos;
          const n = popcount(mask);
          if (n >= 2 && n <= k) lines.push({ line, mask });
        }
        if (lines.length < k) continue;
        for (const set of combos(lines, k)) {
          let union = 0;
          for (const l of set) union |= l.mask;
          if (popcount(union) !== k) continue;
          const base = new Set(set.map((l) => l.line));
          let changed = false;
          for (let line = 0; line < 9; line++) {
            if (base.has(line)) continue;
            for (let pos = 0; pos < 9; pos++) if (union & (1 << pos)) changed = b.drop(at(line, pos), bit(d)) || changed;
          }
          if (changed) return true;
        }
      }
    }
    return false;
  };
}

/** XY-wing : pivot {a,b}, pinces {a,z} et {b,z} qu'il voit ; z sort des cases qui voient les deux pinces. */
function xyWing(b: Board): boolean {
  for (let p = 0; p < CELLS; p++) {
    if (b.v[p] || popcount(b.c[p]!) !== 2) continue;
    const pairs = PEERS[p]!.filter((q) => !b.v[q] && popcount(b.c[q]!) === 2 && popcount(b.c[q]! & b.c[p]!) === 1);
    for (const q1 of pairs) {
      for (const q2 of pairs) {
        if (q2 <= q1) continue;
        const z = b.c[q1]! & b.c[q2]! & ~b.c[p]!;
        if (popcount(z) !== 1 || (b.c[q1]! & b.c[q2]! & b.c[p]!) !== 0) continue;
        if ((b.c[q1]! | b.c[q2]!) !== (b.c[p]! | z)) continue;
        let changed = false;
        for (const i of PEERS[q1]!) if (i !== q2 && i !== p && PEERS[q2]!.includes(i)) changed = b.drop(i, z) || changed;
        if (changed) return true;
      }
    }
  }
  return false;
}

const STEPS: [name: string, level: Level, fn: (b: Board) => boolean][] = [
  ["hiddenSingle", 1, hiddenSingle],
  ["nakedSingle", 1, nakedSingle],
  ["lockedCandidates", 2, lockedCandidates],
  ["nakedPair", 2, nakedSubset(2)],
  ["hiddenPair", 2, hiddenSubset(2)],
  ["nakedTriple", 3, nakedSubset(3)],
  ["hiddenTriple", 3, hiddenSubset(3)],
  ["xWing", 3, fish(2)],
  ["nakedQuad", 4, nakedSubset(4)],
  ["hiddenQuad", 4, hiddenSubset(4)],
  ["xyWing", 4, xyWing],
  ["swordfish", 4, fish(3)],
];

export interface Grade {
  level: Level | null;
  /** nombre d'utilisations de chaque technique */
  used: Record<string, number>;
  /** grille atteinte (pleine si level n'est pas null) */
  values: number[];
}

/** Arrête dès que la grille dépasse `maxLevel` (pour aller vite pendant la génération). */
export function grade(values: readonly number[], maxLevel: Level = 4): Grade {
  const b = new Board(values);
  const used: Record<string, number> = {};
  let level = 0;
  for (;;) {
    if (b.v.every((x) => x !== 0)) return { level: Math.max(level, 1) as Level, used, values: b.v };
    for (let i = 0; i < CELLS; i++) if (!b.v[i] && b.c[i] === 0) return { level: null, used, values: b.v };
    const step = STEPS.find(([, lv, fn]) => lv <= maxLevel && fn(b));
    if (!step) return { level: null, used, values: b.v };
    used[step[0]] = (used[step[0]] ?? 0) + 1;
    level = Math.max(level, step[1]);
  }
}
