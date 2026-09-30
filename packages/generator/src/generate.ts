import { CELLS, gridToString, type Difficulty } from "@sudoku-race/shared";
import { grade, type Level } from "./grader.js";
import { mulberry32, hashSeed, shuffle, type Rng } from "./rng.js";
import { countSolutions, randomSolution } from "./solver.js";

export const LEVELS: Record<Difficulty, Level> = { easy: 1, medium: 2, hard: 3, expert: 4 };

/** Plancher d'indices : une grille facile reste aérée, les grilles dures vont au minimum. */
export const MIN_CLUES: Record<Difficulty, number> = { easy: 36, medium: 28, hard: 24, expert: 0 };

export interface Puzzle {
  grid: string;
  solution: string;
  difficulty: Difficulty;
  clues: number;
  used: Record<string, number>;
}

/**
 * Une tentative : grille complète au hasard, puis on retire les cases par
 * paires symétriques (rotation d'un demi-tour) tant que la solution reste
 * unique et que la résolution ne dépasse pas le niveau visé. La tentative
 * échoue (null) si la grille finale n'atteint pas ce niveau.
 */
export function attempt(rng: Rng, difficulty: Difficulty): Puzzle | null {
  const target = LEVELS[difficulty];
  const solution = randomSolution(rng);
  const grid = [...solution];
  const order = shuffle(
    Array.from({ length: 41 }, (_, i) => i),
    rng,
  );
  let clues = CELLS;
  for (const i of order) {
    const j = CELLS - 1 - i;
    const removed = i === j ? 1 : 2;
    if (clues - removed < MIN_CLUES[difficulty]) continue;
    const [a, b] = [grid[i]!, grid[j]!];
    grid[i] = 0;
    grid[j] = 0;
    if (countSolutions(grid, 2) !== 1 || grade(grid, target).level === null) {
      grid[i] = a;
      grid[j] = b;
      continue;
    }
    clues -= removed;
  }
  const g = grade(grid);
  if (g.level !== target) return null;
  return { grid: gridToString(grid), solution: gridToString(solution), difficulty, clues, used: g.used };
}

/** Grille du jour, reproductible : même graine et même jour donnent la même grille. */
export function puzzleForDay(seed: string, day: string, difficulty: Difficulty): Puzzle & { attempts: number } {
  const rng = mulberry32(hashSeed(`${seed}:${day}`));
  for (let attempts = 1; ; attempts++) {
    const p = attempt(rng, difficulty);
    if (p) return { ...p, attempts };
  }
}
