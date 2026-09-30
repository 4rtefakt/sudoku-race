import { cors, error, json, type Env } from "./http.js";
import { authenticate, createPlayer, getPlayer, updatePlayer } from "./players.js";
import { days, finish, getPuzzle, start } from "./game.js";
import { addFriend, board, listFriends, removeFriend, season } from "./social.js";

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname: path } = url;
    const method = request.method;
    if (method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env) });

    if (path === "/api/health") return json(env, { ok: true });
    // Seule route sans identité : création du profil anonyme.
    if (path === "/api/player" && method === "POST") return createPlayer(request, env);

    if (!path.startsWith("/api/")) return error(env, "not_found", 404);
    const me = await authenticate(request, env);
    if (!me) return error(env, "unauthorized", 401);

    if (path === "/api/player") {
      if (method === "GET") return getPlayer(env, me);
      if (method === "PATCH") return updatePlayer(request, env, me);
    }
    if (path === "/api/start" && method === "POST") return start(request, env, me);
    if (path === "/api/finish" && method === "POST") return finish(request, env, me);
    if (path === "/api/days" && method === "GET") return days(env, me);
    if (path === "/api/friends" && method === "GET") return listFriends(env, me);

    let m = path.match(/^\/api\/(puzzle|board|season)\/([0-9-]+)$/);
    if (m && method === "GET") {
      if (m[1] === "puzzle") return getPuzzle(env, me, m[2]!);
      if (m[1] === "board") return board(env, me, m[2]!);
      return season(env, me, m[2]!);
    }
    m = path.match(/^\/api\/friends\/([A-Za-z0-9-]+)$/);
    if (m) {
      if (method === "POST") return addFriend(env, me, m[1]!);
      if (method === "DELETE") return removeFriend(env, me, m[1]!);
    }
    return error(env, "not_found", 404);
  },
} satisfies ExportedHandler<Env>;
