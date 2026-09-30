import { describe, expect, it } from "vitest";
import {
  addDays,
  allPseudos,
  conflicts,
  dayKey,
  difficultyForDay,
  isComplete,
  isDayKey,
  keepsGivens,
  MAX_PSEUDO_LENGTH,
  normalizeFriendCode,
  parseGrid,
  PEERS,
  randomPseudo,
  rankByTime,
  sanitizePseudo,
  seasonTable,
  UNITS,
  weekDays,
  weekday,
  withNumber,
} from "../src/index.js";

const SOLVED = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("sudoku", () => {
  it("a 27 unités et 20 voisins par case", () => {
    expect(UNITS).toHaveLength(27);
    for (const p of PEERS) expect(p).toHaveLength(20);
  });

  it("reconnaît une grille finie", () => {
    expect(isComplete(parseGrid(SOLVED))).toBe(true);
    expect(conflicts(parseGrid(SOLVED)).size).toBe(0);
  });

  it("repère les doublons", () => {
    const v = parseGrid(SOLVED);
    [v[0], v[1]] = [v[1]!, v[0]!]; // deux chiffres échangés dans la ligne : doublons en colonne
    expect(isComplete(v)).toBe(false);
    expect(conflicts(v).has(0)).toBe(true);
  });

  it("vérifie que les chiffres donnés sont gardés", () => {
    const givens = "5" + "0".repeat(80);
    expect(keepsGivens(givens, SOLVED)).toBe(true);
    expect(keepsGivens("6" + "0".repeat(80), SOLVED)).toBe(false);
  });
});

describe("jours", () => {
  it("calcule le jour à Paris", () => {
    // 23 h 30 UTC le 30 septembre = 1 h 30 le 1er octobre à Paris (heure d'été)
    expect(dayKey(new Date("2026-09-30T23:30:00Z"))).toBe("2026-10-01");
    expect(dayKey(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12-31");
    expect(dayKey(new Date("2026-12-31T23:00:00Z"))).toBe("2027-01-01");
  });

  it("valide les clés", () => {
    expect(isDayKey("2026-02-28")).toBe(true);
    expect(isDayKey("2026-02-30")).toBe(false);
    expect(isDayKey("2026-2-3")).toBe(false);
  });

  it("fait tourner la difficulté sur la semaine", () => {
    expect(weekday("2026-09-28")).toBe(0); // lundi
    expect(weekDays("2026-10-01")[0]).toBe("2026-09-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekDays("2026-09-28").map(difficultyForDay)).toEqual(["easy", "easy", "medium", "medium", "hard", "hard", "expert"]);
  });
});

describe("codes et pseudos", () => {
  it("normalise un code ami", () => {
    expect(normalizeFriendCode("abc-234")).toBe("ABC234");
    expect(normalizeFriendCode("ABCD10")).toBeNull(); // 1 et 0 exclus
    expect(normalizeFriendCode("ABC23")).toBeNull();
  });

  it("tire des pseudos courts dans les deux langues", () => {
    for (const lang of ["fr", "en"] as const) {
      const all = allPseudos(lang);
      expect(all.length).toBeGreaterThan(150);
      for (let i = 0; i < 200; i++) expect(randomPseudo(lang).length).toBeLessThanOrEqual(MAX_PSEUDO_LENGTH);
    }
    expect(allPseudos("fr")).toContain("Mouette sournoise");
    expect(allPseudos("fr")).toContain("Ragondin cosmique");
    expect(allPseudos("en")).toContain("Cosmic Coypu");
  });

  it("numérote sans dépasser 20 caractères", () => {
    expect(withNumber("Castor zen", 2)).toBe("Castor zen 2");
    expect(withNumber("Sanglier mélancolique".slice(0, 20), 42).length).toBeLessThanOrEqual(MAX_PSEUDO_LENGTH);
  });

  it("nettoie un pseudo saisi", () => {
    expect(sanitizePseudo("  Héron \u0007 zen  ")).toBe("Héron zen");
    expect(sanitizePseudo("   ")).toBeNull();
    expect(sanitizePseudo("x".repeat(21))).toBeNull();
  });
});

describe("saison", () => {
  it("classe les ex æquo au même rang", () => {
    expect(rankByTime([{ timeMs: 5 }, { timeMs: 3 }, { timeMs: 3 }]).map((e) => e.rank)).toEqual([1, 1, 3]);
  });

  it("donne 3, 2 puis 1 point", () => {
    const days = ["2026-09-28", "2026-09-29"];
    const table = seasonTable(days, [
      { player: "a", day: days[0]!, timeMs: 100 },
      { player: "b", day: days[0]!, timeMs: 200 },
      { player: "c", day: days[0]!, timeMs: 300 },
      { player: "c", day: days[1]!, timeMs: 50 },
    ]);
    expect(table.get("a")).toEqual({ total: 3, perDay: [3, null] });
    expect(table.get("b")).toEqual({ total: 2, perDay: [2, null] });
    expect(table.get("c")).toEqual({ total: 4, perDay: [1, 3] });
  });
});
