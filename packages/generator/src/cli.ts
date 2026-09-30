/**
 * Génère une grille par jour et écrit le seed SQL de la table `puzzles` :
 *   npm run gen -- [--from 2026-09-28] [--to 2027-12-31] [--seed sudoku-race] [--out chemin.sql]
 * Chaque jour a sa propre graine (seed + jour) : relancer sur une période plus
 * longue redonne les mêmes grilles pour les jours déjà générés, et le seed
 * utilise INSERT OR IGNORE, donc il peut être réappliqué sans risque.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, daysBetween, difficultyForDay, FIRST_DAY, isDayKey, type Difficulty } from "@sudoku-race/shared";
import { puzzleForDay } from "./generate.js";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_OUT = resolve(here, "../../worker/seed/puzzles.sql");

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const from = arg("from", FIRST_DAY);
const to = arg("to", "2027-12-31");
const seed = arg("seed", "sudoku-race");
const out = resolve(process.cwd(), arg("out", DEFAULT_OUT));
if (!isDayKey(from) || !isDayKey(to) || daysBetween(from, to) < 0) {
  console.error("--from et --to : dates AAAA-MM-JJ, from ≤ to");
  process.exit(1);
}

const total = daysBetween(from, to) + 1;
const rows: string[] = [];
const stats: Record<Difficulty, { n: number; clues: number; ms: number }> = {
  easy: { n: 0, clues: 0, ms: 0 },
  medium: { n: 0, clues: 0, ms: 0 },
  hard: { n: 0, clues: 0, ms: 0 },
  expert: { n: 0, clues: 0, ms: 0 },
};
const t0 = performance.now();
for (let k = 0; k < total; k++) {
  const day = addDays(from, k);
  const difficulty = difficultyForDay(day);
  const t = performance.now();
  const p = puzzleForDay(seed, day, difficulty);
  const s = stats[difficulty];
  s.n++;
  s.clues += p.clues;
  s.ms += performance.now() - t;
  rows.push(`('${day}','${p.grid}','${p.solution}','${difficulty}')`);
  if (process.stdout.isTTY) process.stdout.write(`\r${k + 1}/${total} ${day} ${difficulty.padEnd(6)} ${p.clues} indices, ${p.attempts} essai(s)   `);
}
if (process.stdout.isTTY) process.stdout.write("\n");

// D1 limite la taille d'une requête : insertions par paquets de 50 lignes.
const chunks: string[] = [];
for (let i = 0; i < rows.length; i += 50) {
  chunks.push(`INSERT OR IGNORE INTO puzzles (day, grid, solution, difficulty) VALUES\n${rows.slice(i, i + 50).join(",\n")};`);
}
const sql = `-- Généré par packages/generator (graine « ${seed} ») : ${total} grilles du ${from} au ${to}.
-- Ne pas modifier à la main : relancer \`npm run gen\`. Les jours déjà en base ne sont jamais remplacés.
${chunks.join("\n")}
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, sql);

for (const [d, s] of Object.entries(stats)) {
  if (s.n) console.log(`${d.padEnd(6)} ${String(s.n).padStart(4)} grilles, ${(s.clues / s.n).toFixed(1)} indices en moyenne, ${(s.ms / s.n).toFixed(0)} ms/grille`);
}
console.log(`${total} grilles en ${((performance.now() - t0) / 1000).toFixed(0)} s → ${out}`);
