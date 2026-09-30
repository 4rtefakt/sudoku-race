/**
 * Grille 9 × 9 : 81 cases indexées ligne par ligne (i = 9 × ligne + colonne).
 * Format texte : 81 caractères, « 0 » pour une case vide.
 */
export const SIZE = 9;
export const CELLS = 81;

export const rowOf = (i: number) => Math.floor(i / SIZE);
export const colOf = (i: number) => i % SIZE;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** Les 27 unités : 9 lignes, 9 colonnes, 9 régions. */
export const UNITS: readonly (readonly number[])[] = (() => {
  const units: number[][] = [];
  for (let r = 0; r < SIZE; r++) units.push(Array.from({ length: SIZE }, (_, c) => r * SIZE + c));
  for (let c = 0; c < SIZE; c++) units.push(Array.from({ length: SIZE }, (_, r) => r * SIZE + c));
  for (let b = 0; b < SIZE; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    units.push(Array.from({ length: SIZE }, (_, k) => (r0 + Math.floor(k / 3)) * SIZE + c0 + (k % 3)));
  }
  return units;
})();

/** Pour chaque case, les 20 cases qui partagent sa ligne, sa colonne ou sa région. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set<number>();
  for (const u of UNITS) if (u.includes(i)) for (const j of u) if (j !== i) set.add(j);
  return [...set].sort((a, b) => a - b);
});

export function isGridString(s: unknown): s is string {
  return typeof s === "string" && /^[0-9]{81}$/.test(s);
}

export function parseGrid(s: string): number[] {
  return Array.from(s, (ch) => ch.charCodeAt(0) - 48);
}

export function gridToString(values: readonly number[]): string {
  return values.join("");
}

/** Vrai si le chiffre de la case i se retrouve dans une case voisine. */
export function clashes(values: readonly number[], i: number, v = values[i]!): boolean {
  if (!v) return false;
  for (const j of PEERS[i]!) if (values[j] === v) return true;
  return false;
}

/** Cases dont le chiffre est en double dans leur ligne, colonne ou région. */
export function conflicts(values: readonly number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < CELLS; i++) if (clashes(values, i)) out.add(i);
  return out;
}

/**
 * Grille pleine et sans doublon. Pour une grille à solution unique dont les
 * chiffres donnés sont conservés, c'est exactement la solution : le client
 * peut donc savoir qu'il a fini sans jamais connaître la solution.
 */
export function isComplete(values: readonly number[]): boolean {
  return values.length === CELLS && values.every((v) => v >= 1 && v <= 9) && conflicts(values).size === 0;
}

/** Vrai si `values` garde tous les chiffres donnés de `givens`. */
export function keepsGivens(givens: string, values: string): boolean {
  for (let i = 0; i < CELLS; i++) if (givens[i] !== "0" && givens[i] !== values[i]) return false;
  return true;
}

/** Combien de fois chaque chiffre est déjà posé (index 1..9). */
export function digitCounts(values: readonly number[]): number[] {
  const counts = new Array<number>(10).fill(0);
  for (const v of values) counts[v]!++;
  return counts;
}
