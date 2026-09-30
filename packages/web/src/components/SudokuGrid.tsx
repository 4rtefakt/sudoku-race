import { boxOf, colOf, rowOf } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { noteDigits } from "../lib/game.js";

interface Props {
  givens: string;
  values: number[];
  notes: number[];
  selected: number | null;
  conflicts: Set<number> | null;
  onSelect?: (i: number) => void;
  solved?: boolean;
  /** grille masquée (avant le départ) */
  hidden?: boolean;
}

const NOTE_POS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function SudokuGrid({ givens, values, notes, selected, conflicts, onSelect, solved, hidden }: Props) {
  const t = useT();
  const sel = selected ?? -1;
  const selValue = sel >= 0 ? values[sel]! : 0;
  const cls = ["sudoku", solved ? "solved" : "", hidden ? "hidden" : "", onSelect ? "interactive" : ""].filter(Boolean).join(" ");

  return (
    <div className={cls} role="grid" aria-label={t.gridLabel} aria-readonly={!onSelect || undefined} id="grid" tabIndex={-1}>
      {Array.from({ length: 9 }, (_, r) => (
        <div className="s-row" role="row" key={r}>
          {Array.from({ length: 9 }, (_, c) => {
            const i = r * 9 + c;
            const v = values[i]!;
            const given = givens[i] !== "0";
            const related = sel >= 0 && i !== sel && (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel));
            const same = selValue > 0 && v === selValue && i !== sel;
            const bad = !!conflicts?.has(i);
            const cellCls = [
              "s-cell",
              given ? "given" : v ? "filled" : "",
              i === sel ? "selected" : related ? "related" : "",
              same ? "same" : "",
              bad ? "conflict" : "",
              c === 2 || c === 5 ? "box-r" : "",
              r === 2 || r === 5 ? "box-b" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const nd = v ? [] : noteDigits(notes[i]!);
            return (
              <div
                key={c}
                role="gridcell"
                className={cellCls}
                aria-selected={i === sel}
                aria-label={hidden ? undefined : t.cellLabel(r, c, v, given, nd)}
                onPointerDown={
                  onSelect
                    ? (e) => {
                        e.preventDefault();
                        onSelect(i);
                      }
                    : undefined
                }
              >
                {hidden ? null : v ? (
                  <span className="s-digit">{v}</span>
                ) : nd.length ? (
                  <span className="s-notes" aria-hidden>
                    {NOTE_POS.map((d) => (
                      <span key={d} className={d === selValue ? "hl" : ""}>
                        {nd.includes(d) ? d : ""}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
