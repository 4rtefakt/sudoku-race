import {
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_LENGTH,
  isLang,
  isSecret,
  randomPseudo,
  sanitizePseudo,
  withNumber,
  type CreatePlayerRequest,
  type CreatePlayerResponse,
  type Profile,
  type UpdatePlayerRequest,
} from "@sudoku-race/shared";
import { body, error, json, type Env } from "./http.js";

export interface Player {
  id: number;
  pseudo: string;
  friend_code: string;
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomFriendCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FRIEND_CODE_LENGTH));
  let code = "";
  for (const b of bytes) code += FRIEND_CODE_ALPHABET[b % FRIEND_CODE_ALPHABET.length];
  return code;
}

const profile = (p: Player): Profile => ({ pseudo: p.pseudo, friendCode: p.friend_code });

/** Joueur du jeton `Authorization: Bearer <secret>`, ou null. */
export async function authenticate(request: Request, env: Env): Promise<Player | null> {
  const m = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!m || !isSecret(m[1])) return null;
  return env.DB.prepare("SELECT id, pseudo, friend_code FROM players WHERE secret_hash = ?").bind(await sha256Hex(m[1])).first<Player>();
}

/** Pseudo au hasard ; un numéro n'est ajouté qu'en cas de doublon. */
async function freePseudo(env: Env, lang: "fr" | "en"): Promise<string> {
  const taken = async (p: string) => (await env.DB.prepare("SELECT 1 FROM players WHERE pseudo = ?").bind(p).first()) !== null;
  const base = randomPseudo(lang);
  if (!(await taken(base))) return base;
  for (let i = 0; i < 12; i++) {
    const p = withNumber(base, 2 + Math.floor(Math.random() * (i < 6 ? 98 : 998)));
    if (!(await taken(p))) return p;
  }
  return withNumber(base, Date.now() % 100000);
}

export async function createPlayer(request: Request, env: Env): Promise<Response> {
  if (env.CREATE_LIMITER) {
    const { success } = await env.CREATE_LIMITER.limit({ key: request.headers.get("cf-connecting-ip") ?? "local" });
    if (!success) return error(env, "rate_limited", 429);
  }
  const { lang } = await body<CreatePlayerRequest>(request);
  const secret = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await sha256Hex(secret);
  const pseudo = await freePseudo(env, isLang(lang) ? lang : "fr");
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomFriendCode();
    try {
      await env.DB.prepare("INSERT INTO players (secret_hash, friend_code, pseudo, created_at) VALUES (?, ?, ?, ?)").bind(hash, code, pseudo, Date.now()).run();
      return json(env, { secret, pseudo, friendCode: code } satisfies CreatePlayerResponse, 201);
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e;
    }
  }
  return error(env, "code_collision", 500);
}

export function getPlayer(env: Env, me: Player): Response {
  return json(env, profile(me));
}

export async function updatePlayer(request: Request, env: Env, me: Player): Promise<Response> {
  const pseudo = sanitizePseudo((await body<UpdatePlayerRequest>(request)).pseudo);
  if (!pseudo) return error(env, "bad_pseudo", 400);
  await env.DB.prepare("UPDATE players SET pseudo = ? WHERE id = ?").bind(pseudo, me.id).run();
  return json(env, profile({ ...me, pseudo }));
}
