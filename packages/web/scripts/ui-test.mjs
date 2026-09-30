/**
 * Test de bout en bout du front avec Chromium (playwright-core) :
 *   node scripts/ui-test.mjs [http://127.0.0.1:5173]
 * Worker local avec base remplie (`npm run db:local`) : les solutions sont lues
 * dans packages/worker/seed/puzzles.sql pour remplir les grilles.
 * Alice (bureau, clair, français) défie Bob (mobile, sombre, anglais), puis
 * Bob récupère son profil sur un troisième appareil. Captures dans $SHOTS.
 */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const shots = process.env.SHOTS ?? "./shots";
mkdirSync(shots, { recursive: true });
const base = process.argv[2] ?? "http://127.0.0.1:5173";
let exe = process.env.PW_EXE ?? "/opt/pw-browsers/chromium";
try { if (statSync(exe).isDirectory()) exe = undefined; } catch { exe = undefined; }
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const fail = (m) => { console.error("FAIL:", m); process.exit(1); };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const seed = readFileSync(fileURLToPath(new URL("../../worker/seed/puzzles.sql", import.meta.url)), "utf8");
const puzzles = new Map([...seed.matchAll(/\('(\d{4}-\d{2}-\d{2})','(\d{81})','(\d{81})'/g)].map((m) => [m[1], { grid: m[2], solution: m[3] }]));
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const { grid, solution } = puzzles.get(today) ?? fail(`pas de grille pour ${today}`);
const empties = [...grid].flatMap((ch, i) => (ch === "0" ? [i] : []));

function watch(page, who) {
  page.on("pageerror", (e) => console.log(`pageerror ${who}:`, e.message));
  page.on("console", (m) => m.type() === "error" && !m.text().includes("ERR_CERT") && !m.text().includes("fonts.g") && console.log(`console ${who}:`, m.text()));
}
const cell = (page, i) => page.locator(".sudoku .s-cell").nth(i);
async function type(page, i, d) {
  await cell(page, i).click();
  await page.keyboard.press(String(d));
}

try {
  // 1. Alice ouvre le site : profil anonyme créé, grille cachée jusqu'au départ
  const ctxA = await browser.newContext({ viewport: { width: 1180, height: 900 }, locale: "fr-FR" });
  const alice = await ctxA.newPage();
  watch(alice, "A");
  await alice.goto(base);
  await alice.waitForSelector(".intro-card", { timeout: 15000 });
  if ((await alice.locator(".sudoku.hidden .s-digit").count()) !== 0) fail("la grille ne doit pas être visible avant le départ");
  await alice.screenshot({ path: `${shots}/a-intro.png` });
  await alice.click(".intro-card button");
  await alice.waitForSelector(".keypad");
  const givens = await alice.locator(".s-cell.given").count();
  if (givens !== 81 - empties.length) fail(`indices affichés : ${givens}`);
  log("Alice : grille découverte,", givens, "indices");

  // notes, annulation
  const [e0, e1] = empties;
  await cell(alice, e0).click();
  await alice.keyboard.press("n");
  await alice.keyboard.press("1");
  await alice.keyboard.press("2");
  if ((await cell(alice, e0).locator(".s-notes span").allTextContents()).join("") !== "12") fail("notes");
  await alice.keyboard.press("n");
  await alice.keyboard.press("Control+z");
  if ((await cell(alice, e0).locator(".s-notes span").allTextContents()).join("") !== "1") fail("annuler une note");

  // vérification automatique : un doublon compte 10 s
  const clash = Number(grid[[...grid].findIndex((ch, i) => ch !== "0" && Math.floor(i / 9) === Math.floor(e1 / 9))]);
  await alice.click(".tools .tool:has-text('Vérif. auto')");
  await type(alice, e1, clash);
  await alice.waitForSelector(".s-cell.conflict");
  if (!(await alice.locator(".penalty").textContent()).includes("+10 s")) fail("pénalité affichée");
  await alice.keyboard.press("Backspace");
  await alice.click(".tools .tool:has-text('Vérif. auto')");
  log("Alice : notes, annulation et vérification OK (1 erreur)");

  // remplissage ; la dernière case au pavé
  for (const i of empties.slice(0, -1)) await type(alice, i, solution[i]);
  await alice.screenshot({ path: `${shots}/a-playing.png` });
  const last = empties.at(-1);
  await cell(alice, last).click();
  await alice.click(`.keypad .key >> nth=${Number(solution[last]) - 1}`);
  await alice.waitForSelector(".result", { timeout: 10000 });
  const timeA = (await alice.locator(".result-time").textContent()).trim();
  if (!(await alice.locator(".result").textContent()).includes("10 s de pénalité")) fail("pénalité dans le résultat");
  await alice.waitForSelector(".ranking li.me");
  await alice.screenshot({ path: `${shots}/a-solved.png`, fullPage: true });
  log("Alice : grille finie en", timeA);

  await alice.click("a[href='/friends']");
  await alice.waitForSelector(".friend-code");
  const codeA = (await alice.locator(".friend-code").first().textContent()).trim();

  // 2. Bob ouvre le lien de duel d'Alice sur mobile, en sombre et en anglais
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "en-US", colorScheme: "dark" });
  const bob = await ctxB.newPage();
  watch(bob, "B");
  await bob.goto(`${base}/${today}/vs/${codeA}`);
  await bob.waitForSelector(".duel .duel-times", { timeout: 15000 });
  await bob.waitForFunction((t) => document.querySelector(".duel-times")?.textContent?.includes(t), timeA);
  if (!(await bob.locator(".duel").textContent()).includes("is now in your friends")) fail("ajout par le lien de duel");
  await bob.screenshot({ path: `${shots}/b-duel.png` });
  await bob.click(".intro-card button");
  await bob.waitForSelector(".keypad");
  for (const i of empties) {
    await cell(bob, i).tap();
    await bob.click(`.keypad .key >> nth=${Number(solution[i]) - 1}`);
  }
  await bob.waitForSelector(".result", { timeout: 10000 });
  await bob.waitForSelector(".duel-verdict");
  const verdict = await bob.locator(".duel-verdict").textContent();
  await bob.waitForFunction(() => document.querySelectorAll(".ranking li").length === 2);
  await bob.screenshot({ path: `${shots}/b-solved.png`, fullPage: true });
  log("Bob : fini au pavé tactile ·", verdict);

  await bob.goto(`${base}/friends`);
  await bob.waitForSelector(".friend-code");
  const codeB = (await bob.locator(".friend-code").first().textContent()).trim();
  if (!(await bob.locator(".friend-list").textContent()).includes("hasn't added you yet")) fail("amitié à sens unique");

  // 3. Alice ne voit Bob qu'après l'avoir ajouté (lien d'invitation)
  await alice.goto(base);
  await alice.waitForSelector(".ranking li");
  if ((await alice.locator(".ranking li").count()) !== 1) fail("Alice ne devrait voir qu'elle-même");
  await alice.goto(`${base}/add/${codeB.toLowerCase()}`);
  await alice.waitForSelector(".big-line");
  await alice.click("a.button.primary");
  await alice.waitForFunction(() => document.querySelectorAll(".ranking li").length === 2);
  await alice.waitForSelector(".season table");
  await alice.screenshot({ path: `${shots}/a-board.png`, fullPage: true });
  log("Alice : ajoute Bob, classement à deux et saison");

  // jour passé depuis le bandeau
  await alice.click(".archive li:first-child a");
  await alice.waitForSelector(".intro-card");
  if (!(await alice.locator(".day-head").textContent()).includes("jour passé")) fail("mention du jour passé");

  // 4. Bob renomme son profil et affiche son code de transfert
  await bob.goto(`${base}/settings`);
  await bob.fill("#pseudo", "Bob");
  await bob.click("form:has(#pseudo) button[type=submit]");
  await bob.waitForSelector("#pseudo-hint.ok");
  await bob.click("button:has-text('Show my transfer code')");
  await bob.waitForSelector("svg.qr");
  const secret = (await bob.locator("code.secret").textContent()).trim();
  await bob.screenshot({ path: `${shots}/b-settings.png`, fullPage: true });

  // 5. Troisième appareil vierge : le lien du QR code reprend le profil de Bob
  const ctxC = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "fr-FR" });
  const carol = await ctxC.newPage();
  watch(carol, "C");
  await carol.goto(`${base}/restore#${secret}`);
  await carol.waitForSelector(".big-line", { timeout: 15000 });
  if (!(await carol.locator(".big-line").textContent()).includes("Bob")) fail("profil récupéré");
  if (carol.url().includes(secret)) fail("le secret doit quitter la barre d'adresse");
  await carol.click("a.button.primary");
  await carol.waitForSelector(".result");
  log("Troisième appareil : profil de Bob repris, résultat du jour retrouvé");

  await alice.goto(base);
  await alice.waitForFunction(() => [...document.querySelectorAll(".ranking li")].some((li) => li.textContent.includes("Bob")));
  console.log("OK");
} finally {
  await browser.close();
}
