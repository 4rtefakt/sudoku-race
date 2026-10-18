import {
  dayKey,
  isDayKey,
  isGridString,
  penaltyMs,
  type DayStatus,
  type DaysResponse,
  type Difficulty,
  type FinishRequest,
  type FinishResponse,
  type PuzzleInfo,
  type Score,
  type StartRequest,
  type StartResponse,
} from "@sudoku-race/shared";
import { body, error, json, type Env } from "./http.js";
import type { Player } from "./players.js";

/** Au-delà, un nombre d'erreurs n'a plus de sens (et évite un débordement du temps). */
const MAX_MISTAKES = 999;

interface PuzzleRow {
  day: string;
  grid: string;
  solution: string;
  difficulty: Difficulty;
}

interface ScoreRow {
  time_ms: number;
  mistakes: number;
  wrong: number;
  finished_at: number;
}

const toScore = (s: ScoreRow): Score => ({ timeMs: s.time_ms, mistakes: s.mistakes, wrong: s.wrong, finishedAt: s.finished_at });

/** Grille d'un jour déjà ouvert (jamais un jour futur à l'heure de Paris). */
async function playablePuzzle(env: Env, day: unknown): Promise<PuzzleRow | "bad_day" | "not_yet" | "not_found"> {
  if (!isDayKey(day)) return "bad_day";
  if (day > dayKey()) return "not_yet";
  const row = await env.DB.prepare("SELECT day, grid, solution, difficulty FROM puzzles WHERE day = ?").bind(day).first<PuzzleRow>();
  return row ?? "not_found";
}

function puzzleError(env: Env, code: "bad_day" | "not_yet" | "not_found"): Response {
  return error(env, code, code === "bad_day" ? 400 : 404);
}

export async function getPuzzle(env: Env, me: Player, day: string): Promise<Response> {
  const p = await playablePuzzle(env, day);
  if (typeof p === "string") return puzzleError(env, p);
  const [attempt, score] = await env.DB.batch<{ started_at: number } | ScoreRow>([
    env.DB.prepare("SELECT started_at FROM attempts WHERE player_id = ? AND day = ?").bind(me.id, day),
    env.DB.prepare("SELECT time_ms, mistakes, wrong, finished_at FROM scores WHERE player_id = ? AND day = ?").bind(me.id, day),
  ]);
  const a = attempt!.results[0] as { started_at: number } | undefined;
  const s = score!.results[0] as ScoreRow | undefined;
  return json(env, {
    day: p.day,
    today: dayKey(),
    difficulty: p.difficulty,
    now: Date.now(),
    startedAt: a?.started_at ?? null,
    grid: a ? p.grid : null,
    solution: a ? p.solution : null,
    score: s ? toScore(s) : null,
  } satisfies PuzzleInfo);
}

export async function start(request: Request, env: Env, me: Player): Promise<Response> {
  const { day } = await body<StartRequest>(request);
  const p = await playablePuzzle(env, day);
  if (typeof p === "string") return puzzleError(env, p);
  const now = Date.now();
  await env.DB.prepare("INSERT OR IGNORE INTO attempts (player_id, day, started_at) VALUES (?, ?, ?)").bind(me.id, p.day, now).run();
  const a = await env.DB.prepare("SELECT started_at FROM attempts WHERE player_id = ? AND day = ?").bind(me.id, p.day).first<{ started_at: number }>();
  return json(env, { day: p.day, difficulty: p.difficulty, now, startedAt: a!.started_at, grid: p.grid, solution: p.solution } satisfies StartResponse);
}

export async function finish(request: Request, env: Env, me: Player): Promise<Response> {
  const b = await body<FinishRequest>(request);
  const p = await playablePuzzle(env, b.day);
  if (typeof p === "string") return puzzleError(env, p);
  if (!isGridString(b.grid)) return error(env, "bad_grid", 400);
  const count = (n: unknown) => Math.min(MAX_MISTAKES, Math.max(0, Math.floor(Number(n) || 0)));
  const mistakes = count(b.mistakes);
  const wrong = count(b.wrong);

  const existing = await env.DB.prepare("SELECT time_ms, mistakes, wrong, finished_at FROM scores WHERE player_id = ? AND day = ?").bind(me.id, p.day).first<ScoreRow>();
  if (existing) return json(env, { score: toScore(existing), already: true } satisfies FinishResponse);

  const attempt = await env.DB.prepare("SELECT started_at FROM attempts WHERE player_id = ? AND day = ?").bind(me.id, p.day).first<{ started_at: number }>();
  if (!attempt) return error(env, "not_started", 409);
  if (b.grid !== p.solution) return error(env, "wrong", 422);

  const now = Date.now();
  const timeMs = now - attempt.started_at + penaltyMs(mistakes, wrong);
  const res = await env.DB.prepare("INSERT OR IGNORE INTO scores (player_id, day, time_ms, mistakes, wrong, finished_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(me.id, p.day, timeMs, mistakes, wrong, now)
    .run();
  if (res.meta.changes === 0) {
    // deux envois simultanés : le premier gagne
    const s = await env.DB.prepare("SELECT time_ms, mistakes, wrong, finished_at FROM scores WHERE player_id = ? AND day = ?").bind(me.id, p.day).first<ScoreRow>();
    return json(env, { score: toScore(s!), already: true } satisfies FinishResponse);
  }
  return json(env, { score: { timeMs, mistakes, wrong, finishedAt: now }, already: false } satisfies FinishResponse);
}

/** Jours jouables (≤ aujourd'hui), du plus récent au plus ancien, avec mon état pour chacun. */
export async function days(env: Env, me: Player): Promise<Response> {
  const today = dayKey();
  const { results } = await env.DB.prepare(
    `SELECT p.day, p.difficulty, a.started_at, s.time_ms
       FROM puzzles p
       LEFT JOIN attempts a ON a.player_id = ?1 AND a.day = p.day
       LEFT JOIN scores s ON s.player_id = ?1 AND s.day = p.day
      WHERE p.day <= ?2
      ORDER BY p.day DESC
      LIMIT 400`,
  )
    .bind(me.id, today)
    .all<{ day: string; difficulty: Difficulty; started_at: number | null; time_ms: number | null }>();
  const list: DayStatus[] = results.map((r) =>
    r.time_ms !== null ? { day: r.day, difficulty: r.difficulty, state: "done", timeMs: r.time_ms } : { day: r.day, difficulty: r.difficulty, state: r.started_at !== null ? "started" : "new" },
  );
  return json(env, { today, days: list } satisfies DaysResponse);
}
