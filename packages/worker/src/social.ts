import {
  isDayKey,
  normalizeFriendCode,
  rankByTime,
  seasonTable,
  weekDays,
  type AddFriendResponse,
  type BoardResponse,
  type Friend,
  type FriendsResponse,
  type SeasonResponse,
} from "@sudoku-race/shared";
import { error, json, type Env } from "./http.js";
import type { Player } from "./players.js";

/** Mon cercle : moi et les joueurs que j'ai ajoutés. Aucune route ne liste les autres joueurs. */
const CIRCLE = "WITH circle(id) AS (SELECT ?1 UNION SELECT friend_id FROM friendships WHERE player_id = ?1)";

export async function board(env: Env, me: Player, day: string): Promise<Response> {
  if (!isDayKey(day)) return error(env, "bad_day", 400);
  const { results } = await env.DB.prepare(
    `${CIRCLE}
     SELECT p.id, p.pseudo, p.friend_code, s.time_ms, s.mistakes, s.finished_at, a.started_at
       FROM circle c
       JOIN players p ON p.id = c.id
       LEFT JOIN scores s ON s.player_id = p.id AND s.day = ?2
       LEFT JOIN attempts a ON a.player_id = p.id AND a.day = ?2`,
  )
    .bind(me.id, day)
    .all<{ id: number; pseudo: string; friend_code: string; time_ms: number | null; mistakes: number | null; finished_at: number | null; started_at: number | null }>();

  const done = results.filter((r) => r.time_ms !== null);
  const entries = rankByTime(
    done.map((r) => ({ pseudo: r.pseudo, friendCode: r.friend_code, me: r.id === me.id, timeMs: r.time_ms!, mistakes: r.mistakes!, finishedAt: r.finished_at! })),
  );
  const waiting = results
    .filter((r) => r.time_ms === null)
    .map((r) => ({ pseudo: r.pseudo, friendCode: r.friend_code, me: r.id === me.id, started: r.started_at !== null }))
    .sort((a, b) => Number(b.me) - Number(a.me) || a.pseudo.localeCompare(b.pseudo));
  return json(env, { day, entries, waiting } satisfies BoardResponse);
}

export async function season(env: Env, me: Player, day: string): Promise<Response> {
  if (!isDayKey(day)) return error(env, "bad_day", 400);
  const days = weekDays(day);
  const { results } = await env.DB.prepare(
    `${CIRCLE}
     SELECT p.id, p.pseudo, p.friend_code, s.day, s.time_ms
       FROM circle c
       JOIN players p ON p.id = c.id
       LEFT JOIN scores s ON s.player_id = p.id AND s.day BETWEEN ?2 AND ?3`,
  )
    .bind(me.id, days[0], days[6])
    .all<{ id: number; pseudo: string; friend_code: string; day: string | null; time_ms: number | null }>();

  const people = new Map(results.map((r) => [r.id, r]));
  const table = seasonTable(
    days,
    results.filter((r) => r.day !== null).map((r) => ({ player: r.id, day: r.day!, timeMs: r.time_ms! })),
  );
  const rows = [...people.values()]
    .filter((p) => p.id === me.id || table.has(p.id))
    .map((p) => {
      const t = table.get(p.id);
      return { pseudo: p.pseudo, friendCode: p.friend_code, me: p.id === me.id, total: t?.total ?? 0, perDay: t?.perDay ?? days.map(() => null) };
    })
    .sort((a, b) => b.total - a.total || Number(b.me) - Number(a.me) || a.pseudo.localeCompare(b.pseudo));
  return json(env, { days, rows } satisfies SeasonResponse);
}

interface FriendRow {
  pseudo: string;
  friend_code: string;
  created_at: number;
  mutual: number;
}

const toFriend = (r: FriendRow): Friend => ({ pseudo: r.pseudo, friendCode: r.friend_code, addedAt: r.created_at, mutual: r.mutual === 1 });

const FRIEND_SELECT = `SELECT p.pseudo, p.friend_code, f.created_at,
         EXISTS (SELECT 1 FROM friendships r WHERE r.player_id = p.id AND r.friend_id = ?1) AS mutual
    FROM friendships f
    JOIN players p ON p.id = f.friend_id
   WHERE f.player_id = ?1`;

export async function listFriends(env: Env, me: Player): Promise<Response> {
  const { results } = await env.DB.prepare(`${FRIEND_SELECT} ORDER BY p.pseudo COLLATE NOCASE`).bind(me.id).all<FriendRow>();
  return json(env, { friends: results.map(toFriend) } satisfies FriendsResponse);
}

export async function addFriend(env: Env, me: Player, rawCode: string): Promise<Response> {
  const code = normalizeFriendCode(rawCode);
  if (!code) return error(env, "bad_code", 400);
  const other = await env.DB.prepare("SELECT id FROM players WHERE friend_code = ?").bind(code).first<{ id: number }>();
  if (!other) return error(env, "not_found", 404);
  if (other.id === me.id) return error(env, "self", 400);
  const res = await env.DB.prepare("INSERT OR IGNORE INTO friendships (player_id, friend_id, created_at) VALUES (?, ?, ?)").bind(me.id, other.id, Date.now()).run();
  const row = await env.DB.prepare(`${FRIEND_SELECT} AND f.friend_id = ?2`).bind(me.id, other.id).first<FriendRow>();
  return json(env, { friend: toFriend(row!), already: res.meta.changes === 0 } satisfies AddFriendResponse, res.meta.changes === 0 ? 200 : 201);
}

export async function removeFriend(env: Env, me: Player, rawCode: string): Promise<Response> {
  const code = normalizeFriendCode(rawCode);
  if (!code) return error(env, "bad_code", 400);
  await env.DB.prepare("DELETE FROM friendships WHERE player_id = ? AND friend_id = (SELECT id FROM players WHERE friend_code = ?)").bind(me.id, code).run();
  return json(env, { ok: true });
}
