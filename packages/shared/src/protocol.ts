import type { Difficulty } from "./days.js";
import type { Lang } from "./pseudos.js";

/** Réponses d'erreur : `{ error: "not_found" }`, etc. */
export interface ApiError {
  error: string;
}

export interface Profile {
  pseudo: string;
  friendCode: string;
}

export interface CreatePlayerRequest {
  lang?: Lang;
}

/** Le secret n'est renvoyé qu'une fois, à la création ; le serveur n'en garde que le SHA-256. */
export interface CreatePlayerResponse extends Profile {
  secret: string;
}

export interface UpdatePlayerRequest {
  pseudo: string;
}

export interface Score {
  timeMs: number;
  mistakes: number;
  finishedAt: number;
}

/**
 * GET /api/puzzle/:day. La grille n'est envoyée qu'une fois le chrono lancé
 * (POST /api/start), la solution jamais.
 */
export interface PuzzleInfo {
  day: string;
  today: string;
  difficulty: Difficulty;
  /** heure serveur, pour recaler le chrono du client */
  now: number;
  startedAt: number | null;
  grid: string | null;
  score: Score | null;
}

export interface StartRequest {
  day: string;
}

export interface StartResponse {
  day: string;
  difficulty: Difficulty;
  now: number;
  startedAt: number;
  grid: string;
}

export interface FinishRequest {
  day: string;
  grid: string;
  mistakes: number;
}

export interface FinishResponse {
  score: Score;
  /** vrai si un score existait déjà pour ce jour (il n'est pas remplacé) */
  already: boolean;
}

export interface BoardEntry {
  pseudo: string;
  friendCode: string;
  me: boolean;
  rank: number;
  timeMs: number;
  mistakes: number;
  finishedAt: number;
}

export interface BoardWaiting {
  pseudo: string;
  friendCode: string;
  me: boolean;
  started: boolean;
}

export interface BoardResponse {
  day: string;
  entries: BoardEntry[];
  /** moi et mes amis sans score ce jour-là */
  waiting: BoardWaiting[];
}

export interface Friend {
  pseudo: string;
  friendCode: string;
  /** il ou elle m'a aussi ajouté·e */
  mutual: boolean;
  addedAt: number;
}

export interface FriendsResponse {
  friends: Friend[];
}

export interface AddFriendResponse {
  friend: Friend;
  already: boolean;
}

export type DayState = "new" | "started" | "done";

export interface DayStatus {
  day: string;
  difficulty: Difficulty;
  state: DayState;
  timeMs?: number;
}

/** GET /api/days : jours jouables, du plus récent au plus ancien. */
export interface DaysResponse {
  today: string;
  days: DayStatus[];
}

export interface SeasonRow {
  pseudo: string;
  friendCode: string;
  me: boolean;
  total: number;
  perDay: (number | null)[];
}

/** GET /api/season/:day : semaine (lundi → dimanche) qui contient ce jour. */
export interface SeasonResponse {
  days: string[];
  rows: SeasonRow[];
}
