-- Schéma initial. Le secret n'est jamais stocké : seulement son SHA-256 (hex).
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY,
  secret_hash TEXT NOT NULL UNIQUE,
  friend_code TEXT NOT NULL UNIQUE,
  pseudo TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_pseudo ON players(pseudo);

-- Ajout à sens unique : player_id voit friend_id dans son classement.
CREATE TABLE IF NOT EXISTS friendships (
  player_id INTEGER NOT NULL REFERENCES players(id),
  friend_id INTEGER NOT NULL REFERENCES players(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, friend_id)
);

CREATE TABLE IF NOT EXISTS puzzles (
  day TEXT PRIMARY KEY,
  grid TEXT NOT NULL,
  solution TEXT NOT NULL,
  difficulty TEXT NOT NULL
);

-- Début du chrono, fixé au premier POST /api/start (reprendre ne le remet pas à zéro).
CREATE TABLE IF NOT EXISTS attempts (
  player_id INTEGER NOT NULL REFERENCES players(id),
  day TEXT NOT NULL REFERENCES puzzles(day),
  started_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, day)
);

CREATE TABLE IF NOT EXISTS scores (
  player_id INTEGER NOT NULL REFERENCES players(id),
  day TEXT NOT NULL REFERENCES puzzles(day),
  time_ms INTEGER NOT NULL,
  mistakes INTEGER NOT NULL DEFAULT 0,
  finished_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, day)
);
