import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { conflicts, digitCounts, gridToString, isComplete, type Score } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { api, ApiError } from "../lib/api.js";
import { formatTime } from "../lib/format.js";
import { initialState, reduce, type GameAction, type GameState } from "../lib/game.js";
import { getCheck, getProgress, setCheck, setProgress } from "../lib/storage.js";
import { SudokuGrid } from "./SudokuGrid.js";
import { CheckIcon, EraseIcon, PencilIcon, UndoIcon } from "./Icons.js";

interface Props {
  day: string;
  givens: string;
  startedAt: number;
  /** heure serveur − heure locale, pour un chrono juste même si l'horloge du téléphone dérive */
  offset: number;
  onSolved: (score: Score, values: number[]) => void;
}

export function Game({ day, givens, startedAt, offset, onSolved }: Props) {
  const t = useT();
  const [check, setCheckState] = useState(getCheck);
  const [s, dispatch] = useReducer(
    (st: GameState, a: GameAction) => reduce(givens, st, a),
    null,
    () => initialState(givens, getProgress(day)),
  );

  useEffect(() => {
    setProgress(day, { values: s.values, notes: s.notes, mistakes: s.mistakes, flagged: s.flagged });
  }, [day, s.values, s.notes, s.mistakes, s.flagged]);

  // vérification déjà active (réglage) : les doublons d'une partie reprise comptent
  useEffect(() => {
    if (check) dispatch({ type: "enableCheck" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCheck = () => {
    const on = !check;
    setCheckState(on);
    setCheck(on);
    if (on) dispatch({ type: "enableCheck" });
  };

  const conflictSet = useMemo(() => conflicts(s.values), [s.values]);
  const complete = useMemo(() => isComplete(s.values), [s.values]);
  const full = s.values.every((v) => v > 0);
  const counts = useMemo(() => digitCounts(s.values), [s.values]);

  // Grille pleine et sans doublon : c'est la solution (unique), on envoie.
  const [submit, setSubmit] = useState<"idle" | "sending" | "failed" | "wrong">("idle");
  const latest = useRef(s);
  latest.current = s;
  const send = useCallback(async () => {
    const st = latest.current;
    setSubmit("sending");
    try {
      const res = await api.finish(day, gridToString(st.values), st.mistakes);
      onSolved(res.score, st.values);
    } catch (e) {
      setSubmit(e instanceof ApiError && e.code === "wrong" ? "wrong" : "failed");
    }
  }, [day, onSolved]);
  useEffect(() => {
    if (complete && submit === "idle") void send();
    if (!complete && submit === "wrong") setSubmit("idle");
  }, [complete, submit, send]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (document.querySelector("dialog[open]") || complete) return;
      const key = e.key;
      if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "z") {
        e.preventDefault();
        return dispatch({ type: "undo" });
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Chiffre tapé (pavé numérique, QWERTY, AZERTY avec Maj) → chiffre.
      // Touche chiffre sans chiffre produit : avec Maj (QWERTY « ! ») → note, sans (AZERTY « & ») → chiffre.
      const codeDigit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1];
      if (/^[1-9]$/.test(key) || codeDigit) {
        e.preventDefault();
        const d = Number(/^[1-9]$/.test(key) ? key : codeDigit);
        return dispatch({ type: "input", d, note: !/^[1-9]$/.test(key) && e.shiftKey, check });
      }
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[key]) {
        e.preventDefault();
        return dispatch({ type: "move", dr: moves[key]![0], dc: moves[key]![1] });
      }
      if (key === "Backspace" || key === "Delete" || key === "0") {
        e.preventDefault();
        return dispatch({ type: "erase" });
      }
      if (key === "n" || key === "N") return dispatch({ type: "toggleNotes" });
      if (key === "u" || key === "U") return dispatch({ type: "undo" });
      if (key === "Escape") return dispatch({ type: "select", i: null });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [check, complete]);

  const done = complete || submit === "sending";

  return (
    <div className="game">
      <div className="game-bar">
        <Clock startedAt={startedAt} offset={offset} />
        {check && s.mistakes > 0 && (
          <span className="penalty" title={t.mistakes(s.mistakes)}>
            {t.mistakes(s.mistakes)} · {t.penalty(s.mistakes)}
          </span>
        )}
      </div>

      <SudokuGrid
        givens={givens}
        values={s.values}
        notes={s.notes}
        selected={done ? null : s.selected}
        conflicts={check || (full && !complete) ? conflictSet : null}
        onSelect={done ? undefined : (i) => dispatch({ type: "select", i })}
        solved={complete}
      />

      <div className="tools">
        <button type="button" className="tool" onClick={() => dispatch({ type: "undo" })} disabled={done || s.history.length === 0}>
          <UndoIcon />
          <span>{t.undo}</span>
        </button>
        <button type="button" className="tool" onClick={() => dispatch({ type: "erase" })} disabled={done}>
          <EraseIcon />
          <span>{t.erase}</span>
        </button>
        <button type="button" className={`tool${s.notesMode ? " on" : ""}`} aria-pressed={s.notesMode} onClick={() => dispatch({ type: "toggleNotes" })} disabled={done}>
          <PencilIcon />
          <span>{t.notes}</span>
        </button>
        <button type="button" className={`tool${check ? " on" : ""}`} aria-pressed={check} onClick={toggleCheck} disabled={done} title={t.checkHint}>
          <CheckIcon />
          <span>{t.check}</span>
        </button>
      </div>

      <div className={`keypad${s.notesMode ? " notes" : ""}`} role="group" aria-label={t.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
          const left = Math.max(0, 9 - counts[d]!);
          return (
            <button
              key={d}
              type="button"
              className={`key${left === 0 ? " spent" : ""}`}
              aria-label={t.digitLeft(d, left)}
              disabled={done}
              onClick={() => dispatch({ type: "input", d, check })}
            >
              <span className="key-digit">{d}</span>
              <span className="key-left" aria-hidden>
                {left || ""}
              </span>
            </button>
          );
        })}
      </div>

      <div className="game-status" aria-live="polite">
        {submit === "sending" && <p className="muted">{t.submitting}</p>}
        {submit === "failed" && (
          <p className="error">
            {t.submitFailed}{" "}
            <button type="button" onClick={() => void send()}>
              {t.retry}
            </button>
          </p>
        )}
        {submit === "wrong" && <p className="error">{t.wrongGrid}</p>}
        {full && !complete && <p className="error">{t.fullWithErrors}</p>}
        {check && <p className="muted small">{t.checkHint}</p>}
      </div>
    </div>
  );
}

function Clock({ startedAt, offset }: { startedAt: number; offset: number }) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="clock" role="timer" aria-label={t.timer}>
      {formatTime(now + offset - startedAt)}
    </span>
  );
}

