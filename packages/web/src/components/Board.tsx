import type { BoardResponse } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { formatTime } from "../lib/format.js";
import { Link } from "./Link.js";

export function Board({ board, hasFriends }: { board: BoardResponse | null; hasFriends: boolean }) {
  const t = useT();
  return (
    <section className="card board" aria-labelledby="board-title">
      <h2 id="board-title">{t.board}</h2>
      {!board ? (
        <p className="muted">{t.loading}</p>
      ) : (
        <>
          {board.entries.length === 0 ? (
            <p className="muted">{t.boardEmpty}</p>
          ) : (
            <ol className="ranking">
              {board.entries.map((e) => (
                <li key={e.friendCode} className={e.me ? "me" : ""}>
                  <span className={`rank r${e.rank}`}>{e.rank}</span>
                  <span className="who">
                    {e.pseudo}
                    {e.me && <span className="tag">{t.you}</span>}
                  </span>
                  {e.mistakes > 0 && <span className="muted small">{t.mistakesShort(e.mistakes)}</span>}
                  <span className="time">{formatTime(e.timeMs)}</span>
                </li>
              ))}
            </ol>
          )}
          {board.waiting.some((w) => !w.me) && (
            <p className="waiting muted small">
              {t.waiting}{" "}
              {board.waiting
                .filter((w) => !w.me)
                .map((w) => (w.started ? `${w.pseudo} (${t.inProgress})` : w.pseudo))
                .join(", ")}
            </p>
          )}
          {!hasFriends && (
            <p className="small">
              {t.boardNoFriends} <Link href="/friends">{t.addFriends}</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
