# Sudoku Race

Un sudoku par jour, le même pour tout le monde ; le score, c'est le temps. Le
classement ne montre que toi et tes amis (pas de classement général). Pas de
compte, pas de série à tenir : les grilles passées restent jouables.
Français et anglais.

Cousin de [Mots Croisés](https://github.com/4rtefakt/motscroises) et de
[Fléchette](https://github.com/4rtefakt/cofl-ch-s) (mots fléchés) : même
monorepo, même Worker qui sert le front et l'API, même système visuel.

- **Site** : https://sudoku-race.app — le front React + TypeScript + Vite est servi en
  assets statiques par le Worker (même origine que l'API)
- **Données** : D1 (SQLite) : joueurs, amitiés, grilles, départs du chrono, scores
- **Grilles** : générées hors ligne (solution unique, difficulté notée par les
  techniques nécessaires), seed SQL versionné

Documentation : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Arborescence

```
packages/shared     règles du sudoku, jours (heure de Paris), codes ami, pseudos, saison, types de l'API
packages/generator  génération et notation des grilles, écrit packages/worker/seed/puzzles.sql
packages/worker     Worker HTTP (API + assets), migrations D1, seed, test de bout en bout
packages/web        application React (jour, archives, classement, amis, réglages)
docs/               architecture
```

## Prérequis

Node 22+, npm, `wrangler` authentifié (`CLOUDFLARE_API_TOKEN` ou `wrangler login`).

```sh
npm install
npm test          # vitest (shared + generator, dont la vérification de tout le seed)
npm run typecheck # tsc sur les quatre paquets
```

## Générer des grilles

```sh
npm run gen                                   # du 2026-09-28 au 2027-12-31 (≈ 1 min)
npm run gen -- --to 2028-12-31                # prolonger : mêmes grilles pour les jours déjà faits
npm run gen -- --from 2026-09-28 --to 2027-12-31 --seed sudoku-race --out chemin.sql
```

Une grille par jour, difficulté selon le jour de la semaine : lundi-mardi
**facile**, mercredi-jeudi **moyen**, vendredi-samedi **difficile**, dimanche
**expert**. Le générateur tire une grille complète, retire les cases par paires
symétriques tant que la solution reste unique et que la résolution « à la main »
ne dépasse pas le niveau visé, puis garde la grille si elle l'atteint :

| niveau | techniques nécessaires | indices |
|---|---|---|
| facile | singletons nus et cachés | 36 |
| moyen | candidats verrouillés, paires | ≈ 29 |
| difficile | triplets, X-wing | ≈ 28 |
| expert | quadruplets, XY-wing, swordfish | ≈ 28 |

Chaque jour a sa propre graine (graine globale + date) : relancer sur une période
plus longue redonne les mêmes grilles, et le seed utilise `INSERT OR IGNORE`,
donc il se réapplique sans toucher aux jours déjà en base. Le seed est gardé
hors de `migrations/` pour cette raison (une migration ne s'applique qu'une fois).

## Lancer en local

```sh
npm run db:local                      # migrations + seed dans la base D1 locale
# terminal 1 : Worker + D1 local
npm run dev:worker                    # http://localhost:8787
# terminal 2 : front avec proxy /api → 8787
npm run dev:web                       # http://localhost:5173
# test de bout en bout de l'API (deux joueurs, amis, chrono, classement, saison)
node packages/worker/scripts/smoke.mjs http://localhost:8787
# test d'interface (Chromium via playwright-core : duel, ajout d'ami, transfert de profil)
node packages/web/scripts/ui-test.mjs http://127.0.0.1:5173
```

## Déployer

```sh
npm run db:migrate    # migrations sur la base D1 distante
npm run db:seed       # grilles (INSERT OR IGNORE, sans risque à relancer)
npm run deploy        # build du front puis Worker (assets + API)
```

Le Worker est rattaché aux domaines `sudoku-race.app` et `www.sudoku-race.app`
(`routes` dans `packages/worker/wrangler.toml`, DNS créé par Cloudflare au
déploiement), base D1 `sudoku-race` liée sous le nom `DB`. Le front est
construit sans `VITE_API_URL` : il appelle `/api` sur sa propre origine.

Le seed est public, solutions comprises : ce n'est pas pire qu'une appli de
résolution, et le classement ne réunit que des amis. Pour la même raison, la
solution est envoyée au client avec la grille, pour que la vérification
automatique signale aussi les chiffres faux.

La migration `0002_wrong.sql` (colonne `scores.wrong`) doit être appliquée
(`npm run db:migrate`) avant de déployer le Worker qui l'utilise.
