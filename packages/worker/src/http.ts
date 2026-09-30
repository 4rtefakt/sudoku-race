export interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN: string;
  /** limite de création de profils (absente = pas de limite) */
  CREATE_LIMITER?: RateLimit;
}

export function cors(env: Env, extra: HeadersInit = {}): Headers {
  const h = new Headers(extra);
  h.set("access-control-allow-origin", env.ALLOWED_ORIGIN || "*");
  h.set("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  h.set("access-control-allow-headers", "content-type,authorization");
  return h;
}

export function json(env: Env, body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors(env, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }),
  });
}

export function error(env: Env, code: string, status: number): Response {
  return json(env, { error: code }, status);
}

/** Corps JSON (objet) ou objet vide si le corps est absent ou invalide. */
export async function body<T extends object>(request: Request): Promise<Partial<T>> {
  try {
    const b = (await request.json()) as unknown;
    return b && typeof b === "object" ? (b as Partial<T>) : {};
  } catch {
    return {};
  }
}
