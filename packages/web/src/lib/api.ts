import type {
  AddFriendResponse,
  BoardResponse,
  CreatePlayerResponse,
  DaysResponse,
  FinishResponse,
  FriendsResponse,
  Lang,
  Profile,
  PuzzleInfo,
  SeasonResponse,
  StartResponse,
} from "@sudoku-race/shared";
import { getSecret, setSecret } from "./storage.js";

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

let token: string | null = getSecret();

export function currentSecret(): string | null {
  return token;
}

export function adoptSecret(secret: string) {
  token = secret;
  setSecret(secret);
}

async function call<T>(method: string, path: string, body?: unknown, auth: string | null = token): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(auth ? { authorization: `Bearer ${auth}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "http");
  return data as T;
}

export const api = {
  createPlayer: (lang: Lang) => call<CreatePlayerResponse>("POST", "/api/player", { lang }, null),
  me: (secret: string | null = token) => call<Profile>("GET", "/api/player", undefined, secret),
  rename: (pseudo: string) => call<Profile>("PATCH", "/api/player", { pseudo }),
  days: () => call<DaysResponse>("GET", "/api/days"),
  puzzle: (day: string) => call<PuzzleInfo>("GET", `/api/puzzle/${day}`),
  start: (day: string) => call<StartResponse>("POST", "/api/start", { day }),
  finish: (day: string, grid: string, mistakes: number, wrong: number) => call<FinishResponse>("POST", "/api/finish", { day, grid, mistakes, wrong }),
  board: (day: string) => call<BoardResponse>("GET", `/api/board/${day}`),
  season: (day: string) => call<SeasonResponse>("GET", `/api/season/${day}`),
  friends: () => call<FriendsResponse>("GET", "/api/friends"),
  addFriend: (code: string) => call<AddFriendResponse>("POST", `/api/friends/${code}`),
  removeFriend: (code: string) => call<{ ok: true }>("DELETE", `/api/friends/${code}`),
};

/** Liens partageables, toujours sur l'origine du site. */
export const links = {
  invite: (code: string) => `${window.location.origin}/add/${code}`,
  duel: (day: string, code: string) => `${window.location.origin}/${day}/vs/${code}`,
  day: (day: string) => `${window.location.origin}/${day}`,
  restore: (secret: string) => `${window.location.origin}/restore#${secret}`,
};
