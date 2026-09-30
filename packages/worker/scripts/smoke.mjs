/**
 * Test de bout en bout de l'API contre un Worker local ou déployé :
 *   node scripts/smoke.mjs [http://localhost:8787]
 * Lit les solutions dans seed/puzzles.sql (base locale remplie par `npm run db:local`).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const base = process.argv[2] ?? "http://localhost:8787";
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const fail = (m) => {
  console.error("FAIL:", m);
  process.exit(1);
};
const seed = readFileSync(fileURLToPath(new URL("../seed/puzzles.sql", import.meta.url)), "utf8");
const solutions = new Map([...seed.matchAll(/\('(\d{4}-\d{2}-\d{2})','(\d{81})','(\d{81})'/g)].map((m) => [m[1], { grid: m[2], solution: m[3] }]));

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const expect = (cond, msg) => cond || fail(msg);

expect((await api("GET", "/api/health")).data?.ok, "health");
expect((await api("GET", "/api/player")).status === 401, "sans jeton → 401");

const a = await api("POST", "/api/player", { body: { lang: "fr" } });
const b = await api("POST", "/api/player", { body: { lang: "en" } });
expect(a.status === 201 && b.status === 201, `création ${a.status} ${b.status}`);
const A = a.data;
const B = b.data;
log("joueurs :", A.pseudo, A.friendCode, "/", B.pseudo, B.friendCode);
expect(/^[A-HJKMNP-Z2-9]{6}$/.test(A.friendCode), "format du code ami");
expect(A.secret.length === 43, "secret base64url de 32 octets");

const me = await api("GET", "/api/player", { token: A.secret });
expect(me.data.friendCode === A.friendCode && !("secret" in me.data), "profil");
const renamed = await api("PATCH", "/api/player", { token: A.secret, body: { pseudo: "  Alice  " } });
expect(renamed.data.pseudo === "Alice", "changement de pseudo");
expect((await api("PATCH", "/api/player", { token: A.secret, body: { pseudo: "x".repeat(21) } })).status === 400, "pseudo trop long");

// amis : ajout à sens unique
expect((await api("POST", `/api/friends/${A.friendCode}`, { token: A.secret })).status === 400, "s'ajouter soi-même");
expect((await api("POST", "/api/friends/ZZZZZZ", { token: A.secret })).status === 404, "code inconnu");
const add = await api("POST", `/api/friends/${B.friendCode.toLowerCase()}`, { token: A.secret });
expect(add.status === 201 && add.data.friend.pseudo === B.pseudo && !add.data.friend.mutual, "ajout d'ami");
expect((await api("POST", `/api/friends/${B.friendCode}`, { token: A.secret })).data.already, "ajout en double");
expect((await api("GET", "/api/friends", { token: B.secret })).data.friends.length === 0, "B n'a encore personne");

// jours
const days = await api("GET", "/api/days", { token: A.secret });
const today = days.data.today;
expect(days.data.days[0].day === today && days.data.days.every((d) => d.day <= today), "jours jouables");
log("aujourd'hui", today, "·", days.data.days.length, "jours jouables");
const future = [...solutions.keys()].find((d) => d > today);
if (future) expect((await api("GET", `/api/puzzle/${future}`, { token: A.secret })).status === 404, "jour futur caché");

// partie : la grille n'arrive qu'au départ du chrono
const before = await api("GET", `/api/puzzle/${today}`, { token: A.secret });
expect(before.status === 200 && before.data.grid === null && before.data.startedAt === null, "grille cachée avant le départ");
expect(!JSON.stringify(before.data).includes(solutions.get(today).solution), "jamais de solution");
const st = await api("POST", "/api/start", { token: A.secret, body: { day: today } });
expect(st.data.grid === solutions.get(today).grid, "grille au départ");
await new Promise((r) => setTimeout(r, 1100));
const st2 = await api("POST", "/api/start", { token: A.secret, body: { day: today } });
expect(st2.data.startedAt === st.data.startedAt, "reprendre garde le départ");
expect((await api("POST", "/api/finish", { token: B.secret, body: { day: today, grid: solutions.get(today).solution, mistakes: 0 } })).status === 409, "finir sans avoir commencé");
expect((await api("POST", "/api/finish", { token: A.secret, body: { day: today, grid: solutions.get(today).grid, mistakes: 0 } })).status === 422, "grille fausse");
const fin = await api("POST", "/api/finish", { token: A.secret, body: { day: today, grid: solutions.get(today).solution, mistakes: 2 } });
expect(fin.status === 200 && !fin.data.already, "fin de partie");
expect(fin.data.score.timeMs >= 21_000 && fin.data.score.mistakes === 2, `temps avec pénalités ${fin.data.score.timeMs}`);
const again = await api("POST", "/api/finish", { token: A.secret, body: { day: today, grid: solutions.get(today).solution, mistakes: 0 } });
expect(again.data.already && again.data.score.timeMs === fin.data.score.timeMs, "un seul score par jour");
log("A finit en", fin.data.score.timeMs, "ms (2 erreurs)");

// B joue un jour passé, plus vite
const past = days.data.days.at(-1).day;
await api("POST", "/api/start", { token: B.secret, body: { day: past } });
await api("POST", "/api/start", { token: B.secret, body: { day: today } });
const finB = await api("POST", "/api/finish", { token: B.secret, body: { day: today, grid: solutions.get(today).solution, mistakes: 0 } });
expect(finB.status === 200 && finB.data.score.timeMs < fin.data.score.timeMs, "B plus rapide");

// classement : A voit B, B ne voit pas A tant qu'il ne l'a pas ajouté
const boardA = await api("GET", `/api/board/${today}`, { token: A.secret });
expect(boardA.data.entries.map((e) => e.pseudo).join() === `${B.pseudo},Alice`, "classement de A");
expect(boardA.data.entries[0].rank === 1 && boardA.data.entries[1].me, "rangs");
const boardB = await api("GET", `/api/board/${today}`, { token: B.secret });
expect(boardB.data.entries.length === 1 && boardB.data.entries[0].me, "classement de B : lui seul");
await api("POST", `/api/friends/${A.friendCode}`, { token: B.secret });
const friendsA = await api("GET", "/api/friends", { token: A.secret });
expect(friendsA.data.friends[0].mutual, "amitié réciproque");
const boardB2 = await api("GET", `/api/board/${past}`, { token: B.secret });
expect(boardB2.data.entries.length === 0 && boardB2.data.waiting.some((w) => w.me && w.started), "jour passé commencé");

// saison
const season = await api("GET", `/api/season/${today}`, { token: A.secret });
const rowB = season.data.rows.find((r) => r.pseudo === B.pseudo);
const rowA = season.data.rows.find((r) => r.me);
expect(season.data.days.length === 7 && rowB.total === 3 && rowA.total === 2, `saison ${JSON.stringify(season.data.rows)}`);

// retrait
await api("DELETE", `/api/friends/${B.friendCode}`, { token: A.secret });
expect((await api("GET", "/api/friends", { token: A.secret })).data.friends.length === 0, "retrait d'ami");
expect((await api("GET", `/api/board/${today}`, { token: A.secret })).data.entries.length === 1, "classement après retrait");

log("OK");
