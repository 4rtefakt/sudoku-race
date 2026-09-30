import type { SeasonResponse } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";

/** Petit tableau de la semaine : un point par jour et par joueur, total à droite. Pas de série. */
export function Season({ season, today }: { season: SeasonResponse | null; today: string }) {
  const t = useT();
  if (!season || !season.rows.some((r) => r.total > 0)) return null;
  return (
    <section className="card season" aria-labelledby="season-title">
      <h2 id="season-title">{t.season}</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">{t.friends}</span>
            </th>
            {season.days.map((d, i) => (
              <th key={d} scope="col" className={d === today ? "today" : ""} title={d}>
                {t.weekdaysShort[i]}
              </th>
            ))}
            <th scope="col" className="total">
              Σ
            </th>
          </tr>
        </thead>
        <tbody>
          {season.rows.map((r) => (
            <tr key={r.friendCode} className={r.me ? "me" : ""}>
              <th scope="row">{r.pseudo}</th>
              {r.perDay.map((p, i) => (
                <td key={i} className={p === null ? "none" : `p${p}`}>
                  {p ?? "·"}
                </td>
              ))}
              <td className="total">{t.points(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">{t.seasonHint}</p>
    </section>
  );
}
