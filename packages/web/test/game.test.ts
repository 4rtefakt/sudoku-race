import { beforeEach, describe, expect, it } from "vitest";
import { initialState, reduce, type GameAction, type GameState } from "../src/lib/game.js";
import { getBigNotes, getProgress, setBigNotes, setProgress } from "../src/lib/storage.js";

const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const GIVENS = "0".repeat(81);

function play(actions: GameAction[], s: GameState = initialState(GIVENS, null)): GameState {
  return actions.reduce((st, a) => reduce(GIVENS, SOLUTION, st, a), s);
}
const at = (i: number, d: number, check = true): GameAction[] => [{ type: "select", i }, { type: "input", d, check }];

describe("vérification automatique", () => {
  it("chiffre faux sans doublon : +30 s ; doublon : +10 s, même s'il est aussi faux", () => {
    let s = play(at(0, 1));
    expect([s.mistakes, s.wrong]).toEqual([0, 1]);
    s = play(at(1, 1), s);
    expect([s.mistakes, s.wrong]).toEqual([1, 1]);
    s = play(at(2, 4), s);
    expect([s.mistakes, s.wrong]).toEqual([1, 1]);
  });

  it("une même erreur ne compte qu'une fois", () => {
    const s = play([...at(0, 1), { type: "erase" }, ...at(0, 1)]);
    expect(s.wrong).toBe(1);
  });

  it("activer la vérification compte les chiffres faux déjà posés", () => {
    let s = play([...at(0, 1, false), ...at(2, 4, false)]);
    expect([s.mistakes, s.wrong]).toEqual([0, 0]);
    s = play([{ type: "enableCheck" }], s);
    expect([s.mistakes, s.wrong]).toEqual([0, 1]);
  });

  it("sans solution connue, seuls les doublons comptent", () => {
    const s = [...at(0, 1), ...at(1, 1)].reduce((st, a) => reduce(GIVENS, null, st, a), initialState(GIVENS, null));
    expect([s.mistakes, s.wrong]).toEqual([1, 0]);
  });
});

describe("annuler et rétablir", () => {
  it("rétablit ce qui a été annulé, jusqu'à une nouvelle modification", () => {
    let s = play([...at(2, 4), ...at(1, 3), { type: "undo", check: true }]);
    expect(s.values[1]).toBe(0);
    expect(s.future).toHaveLength(1);
    s = play([{ type: "redo", check: true }], s);
    expect(s.values[1]).toBe(3);
    expect(s.future).toHaveLength(0);
    s = play([{ type: "undo", check: true }, ...at(5, 8)], s);
    expect(s.future).toHaveLength(0);
    expect(play([{ type: "redo", check: true }], s)).toBe(s);
  });

  it("une erreur qui revient en rétablissant est signalée", () => {
    let s = play([...at(0, 1, false), { type: "undo", check: false }, { type: "enableCheck" }]);
    expect(s.wrong).toBe(0);
    s = play([{ type: "redo", check: true }], s);
    expect(s.wrong).toBe(1);
  });
});

describe("stockage local", () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  it("garde l'historique d'annulation et de rétablissement", () => {
    const s = play([...at(2, 4), { type: "input", d: 9, note: true, check: true }, ...at(1, 3), { type: "select", i: 7 }, { type: "input", d: 1, note: true, check: true }, { type: "undo", check: true }]);
    const notes = s.history[0]!.notes.map((_, i) => (i === 3 ? 1022 : 0));
    setProgress("2026-10-18", { ...s, history: [...s.history, { values: s.values, notes }] });
    const back = getProgress("2026-10-18")!;
    expect(back.history).toEqual([...s.history, { values: s.values, notes }]);
    expect(back.future).toEqual(s.future);
    const resumed = play([{ type: "redo", check: true }], initialState(GIVENS, back));
    expect(resumed.notes[7]).toBe(2);
  });

  it("une ancienne sauvegarde sans historique se relit", () => {
    localStorage.setItem("sudokurace:progress:2026-10-01", JSON.stringify({ values: new Array(81).fill(0), notes: new Array(81).fill(0), mistakes: 2, flagged: [] }));
    const p = getProgress("2026-10-01")!;
    expect([p.mistakes, p.wrong, p.history, p.future]).toEqual([2, 0, [], []]);
  });

  it("grosses notes activées d'office pour Pangolin distrait, tant qu'aucun choix n'est fait", () => {
    expect(getBigNotes("Pangolin distrait")).toBe(true);
    expect(getBigNotes("Pangolin Distrait 12")).toBe(true);
    expect(getBigNotes("Pangolin zen")).toBe(false);
    setBigNotes(false);
    expect(getBigNotes("Pangolin distrait")).toBe(false);
    setBigNotes(true);
    expect(getBigNotes("Pangolin zen")).toBe(true);
  });
});
