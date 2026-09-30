import { useEffect, useRef } from "react";
import type { DayStatus } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { formatDay, formatShortDay, formatTime, formatWeekday } from "../lib/format.js";
import { Link } from "./Link.js";

/** Bandeau des jours, du plus ancien au plus récent ; aujourd'hui à droite. */
export function Archive({ days, today, current }: { days: DayStatus[]; today: string; current: string }) {
  const t = useT();
  const ref = useRef<HTMLOListElement>(null);
  const list = [...days].reverse();
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="date"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current, days.length]);
  return (
    <nav className="archive" aria-label={t.archive}>
      <ol ref={ref}>
        {list.map((d) => {
          const state = d.state === "done" ? t.dayStateDone(formatTime(d.timeMs ?? 0)) : d.state === "started" ? t.dayStateStarted : t.dayStateNew;
          const label = `${formatDay(d.day, t.locale)} · ${t.difficulty[d.difficulty]} · ${state}`;
          return (
            <li key={d.day}>
              <Link
                href={d.day === today ? "/" : `/${d.day}`}
                className={`chip ${d.state} ${d.difficulty}`}
                aria-current={d.day === current ? "date" : undefined}
                aria-label={label}
                title={label}
              >
                <span className="chip-wd">{d.day === today ? t.today : formatWeekday(d.day, t.locale)}</span>
                <span className="chip-day">{formatShortDay(d.day, t.locale)}</span>
                <span className="chip-state" aria-hidden>
                  {d.state === "done" ? formatTime(d.timeMs ?? 0) : d.state === "started" ? "…" : " "}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
