# Sudoku Race — architecture

Déploiement : https://sudoku-race.app (Worker : assets statiques du front + API),
base D1 `sudoku-race`.

Même organisation que Mots Croisés et Fléchette : monorepo npm, paquet `shared`
partagé par le Worker, le front et le générateur ; le Worker sert le front
construit (`[assets]`, repli SPA) et ne passe en code que pour `/api/*`. Pas de
Durable Object ni de WebSocket ici : chacun joue seul, on compare les temps.

## Vue d'ensemble

```
                 ┌──────────────────────────┐
                 │  front (packages/web)    │  React + Vite, statique,
                 └────────────┬─────────────┘  servi par le Worker
                              │ HTTPS /api/*   Authorization: Bearer <secret>
                 ┌────────────▼─────────────┐
                 │  Worker (packages/worker)│  identité, chrono, validation,
                 │   └─ D1  DB              │  amis, classement, saison
                 └──────────────────────────┘

   hors ligne :  packages/generator  ──►  packages/worker/seed/puzzles.sql  ──►  wrangler d1 execute
```

## Identité anonyme

- Première visite : `POST /api/player {lang}` crée un secret (32 octets aléatoires,
  base64url), un code ami (6 caractères parmi `ABCDEFGHJKMNPQRSTUVWXYZ23456789`) et
  un pseudo au hasard (animal + adjectif, en français ou en anglais selon la
  langue du navigateur ; numéro ajouté seulement en cas de doublon). Limité à 10
  créations par minute et par IP (`[[ratelimits]]`).
- Le client garde le secret en `localStorage` et l'envoie en
  `Authorization: Bearer`. Le serveur ne stocke que son SHA-256.
- Changer d'appareil : les réglages affichent le secret en texte et en QR code.
  Le QR code encode `https://sudoku-race.app/restore#<secret>` : le scanner avec
  l'appareil photo ouvre le site et reprend le profil (le secret est dans le
  fragment, jamais envoyé au serveur ni gardé dans l'historique). Coller le code
  ou le lien dans les réglages fait la même chose. Un appareil vierge reprend le
  profil directement ; sinon une confirmation est demandée.

## Amis

- Lien d'invitation `/add/<code>` : l'ouvrir ajoute ce joueur à ma liste.
- Ajout à sens unique : il apparaît aussitôt dans mon classement, j'apparais dans
  le sien quand il m'ajoute aussi. La liste indique qui m'a ajouté en retour.
  Pas de demande en attente.
- Duel : `/<jour>/vs/<code>` ajoute l'auteur du lien et ouvre la grille de ce
  jour avec un encart « duel » (temps de chacun, verdict, bouton pour renvoyer le
  défi afin que l'autre voie mon temps). N'importe quel jour peut servir.
- Aucune route ne liste les joueurs : tout passe par le cercle « moi + mes amis ».

## Jours, chrono, score

- Clé du jour : date à Paris (`AAAA-MM-JJ`). Un jour futur n'est jamais servi.
- `GET /api/puzzle/:day` ne renvoie la grille qu'une fois le chrono lancé ;
  `POST /api/start` fixe `started_at` au premier appel (reprendre ne le change
  pas) et renvoie la grille. La solution ne quitte jamais le serveur.
- `POST /api/finish {day, grid, mistakes}` : grille == solution, puis
  `time_ms = maintenant − started_at + 10 000 × mistakes`, enregistré une seule
  fois par joueur et par jour. Le temps est celui de l'horloge : fermer la page
  n'arrête pas le chrono.
- Erreurs (déclarées par le client) : la solution étant inconnue du client, une
  erreur est un chiffre posé en doublon dans sa ligne, sa colonne ou son carré.
  Elles ne comptent que si la vérification automatique est active (c'est le prix
  de l'aide) ; activer la vérification compte les doublons déjà présents, et
  chaque (case, chiffre) ne compte qu'une fois. Une grille pleine sans doublon,
  chiffres donnés conservés, est forcément la solution (unicité) : le client sait
  qu'il a fini sans connaître la solution.
- Jours passés : jouables à tout moment, le score compte dans le classement de ce
  jour-là.
- Saison hebdomadaire (lundi → dimanche) : chaque jour, 3 points au plus rapide
  du cercle, 2 au deuxième, 1 à tous les autres qui ont fini (ex æquo au même
  rang). Pas de série.

## Schéma D1

Voir `packages/worker/migrations/0001_init.sql` : `players`, `friendships`,
`puzzles`, `attempts` (départ du chrono), `scores`, conformes à la spec.

## API

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | /api/player | créer l'identité (seule route sans jeton) |
| GET | /api/player | mon profil (pseudo, code ami) |
| PATCH | /api/player | changer de pseudo (20 caractères au plus) |
| GET | /api/days | jours jouables et mon état pour chacun (bandeau des archives) |
| GET | /api/puzzle/:day | difficulté, départ, score ; grille si commencée |
| POST | /api/start | lancer le chrono, recevoir la grille |
| POST | /api/finish | valider et enregistrer le temps |
| GET | /api/board/:day | moi + amis, triés par temps ; amis sans score à part |
| GET | /api/season/:day | points de la semaine qui contient ce jour |
| GET | /api/friends | ma liste (avec « m'a ajouté aussi ») |
| POST | /api/friends/:code | ajouter |
| DELETE | /api/friends/:code | retirer |

Erreurs : `{ "error": "unauthorized" | "bad_day" | "not_yet" | "not_found" | "not_started" | "wrong" | "bad_code" | "self" | "bad_pseudo" | "rate_limited" }`.

## Front

- `/` grille du jour, `/<jour>` un jour passé, `/<jour>/vs/<code>` duel,
  `/add/<code>`, `/friends`, `/settings`, `/restore#<secret>`.
- Avant le départ, grille masquée et bouton « Découvrir la grille ». En jeu :
  chrono (recalé sur l'heure du serveur), notes, annuler, effacer, surlignage
  de la ligne/colonne/carré et des chiffres identiques, vérification automatique
  optionnelle, pavé de chiffres avec le nombre restant ; clavier (chiffres,
  Maj+chiffre ou mode N pour les notes, flèches, retour arrière, Ctrl+Z).
  La partie en cours est gardée en `localStorage` par jour.
- Classement et saison à droite sur grand écran, sous la grille sur mobile ;
  bandeau des jours en haut (difficulté en couleur, temps des grilles finies).
- Textes dans `packages/web/src/i18n/{fr,en}.ts` ; langue du navigateur par
  défaut, modifiable dans les réglages.
