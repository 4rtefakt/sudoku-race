import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, difficultyForDay, FIRST_DAY, isComplete, isGridString, keepsGivens, parseGrid } from "@sudoku-race/shared";
import { grade } from "../src/grader.js";
import { attempt, LEVELS, puzzleForDay } from "../src/generate.js";
import { mulberry32 } from "../src/rng.js";
import { countSolutions, solve } from "../src/solver.js";

const here = dirname(fileURLToPath(import.meta.url));

// Grille classique (Wikipédia) : 30 indices, se résout aux singletons.
const CLASSIC = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const CLASSIC_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("solveur", () => {
  it("résout et compte les solutions", () => {
    expect(solve(parseGrid(CLASSIC))?.join("")).toBe(CLASSIC_SOLUTION);
    expect(countSolutions(parseGrid(CLASSIC))).toBe(1);
    expect(countSolutions(new Array(81).fill(0))).toBe(2);
  });

  it("note la grille classique comme facile", () => {
    const g = grade(parseGrid(CLASSIC));
    expect(g.level).toBe(1);
    expect(g.values.join("")).toBe(CLASSIC_SOLUTION);
  });
});

describe("générateur", () => {
  it("produit des grilles uniques du niveau demandé", () => {
    const rng = mulberry32(7);
    for (const d of ["easy", "medium"] as const) {
      let p = null;
      while (!p) p = attempt(rng, d);
      expect(countSolutions(parseGrid(p.grid))).toBe(1);
      expect(grade(parseGrid(p.grid)).level).toBe(LEVELS[d]);
      expect(keepsGivens(p.grid, p.solution)).toBe(true);
    }
  });

  it("est reproductible jour par jour", () => {
    expect(puzzleForDay("t", "2026-10-01", "easy").grid).toBe(puzzleForDay("t", "2026-10-01", "easy").grid);
  });
});

describe("seed SQL", () => {
  const sql = readFileSync(join(here, "../../worker/seed/puzzles.sql"), "utf8");
  const rows = [...sql.matchAll(/\('(\d{4}-\d{2}-\d{2})','(\d{81})','(\d{81})','(\w+)'\)/g)].map((m) => ({ day: m[1]!, grid: m[2]!, solution: m[3]!, difficulty: m[4]! }));

  it("couvre au moins 365 jours consécutifs depuis le premier jour", () => {
    expect(rows.length).toBeGreaterThanOrEqual(365);
    rows.forEach((r, i) => expect(r.day).toBe(addDays(FIRST_DAY, i)));
  });

  it("contient des grilles valides, uniques et du bon niveau", () => {
    for (const r of rows) {
      expect(isGridString(r.grid) && isGridString(r.solution)).toBe(true);
      expect(isComplete(parseGrid(r.solution))).toBe(true);
      expect(keepsGivens(r.grid, r.solution)).toBe(true);
      expect(r.difficulty).toBe(difficultyForDay(r.day));
      expect(countSolutions(parseGrid(r.grid))).toBe(1);
      const g = grade(parseGrid(r.grid));
      expect(g.level).toBe(LEVELS[r.difficulty as keyof typeof LEVELS]);
      expect(g.values.join("")).toBe(r.solution);
    }
  });
});
