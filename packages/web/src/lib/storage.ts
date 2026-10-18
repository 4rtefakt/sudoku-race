const KEY_SECRET = "sudokurace:secret";
const KEY_CHECK = "sudokurace:check";
const KEY_BIG_NOTES = "sudokurace:bigNotes";
const progressKey = (day: string) => `sudokurace:progress:${day}`;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* mode privé */
  }
}

/** Secret du profil anonyme (envoyé en `Authorization: Bearer`). */
export function getSecret(): string | null {
  return safeGet(KEY_SECRET);
}
export function setSecret(secret: string) {
  safeSet(KEY_SECRET, secret);
}

/** Vérification automatique des doublons et des chiffres faux (désactivée par défaut). */
export function getCheck(): boolean {
  return safeGet(KEY_CHECK) === "1";
}
export function setCheck(on: boolean) {
  safeSet(KEY_CHECK, on ? "1" : "0");
}

/** Pseudos pour qui les grosses notes sont activées tant qu'aucun choix n'est fait. */
const BIG_NOTES_BY_DEFAULT = ["pangolin distrait"];

/** Notes plus grosses et plus contrastées dans la grille. */
export function getBigNotes(pseudo: string): boolean {
  const v = safeGet(KEY_BIG_NOTES);
  if (v !== null) return v === "1";
  const p = pseudo.trim().toLocaleLowerCase("fr");
  return BIG_NOTES_BY_DEFAULT.some((name) => p === name || p.startsWith(`${name} `));
}
export function setBigNotes(on: boolean) {
  safeSet(KEY_BIG_NOTES, on ? "1" : "0");
}

/** Un état de la grille, pour annuler et rétablir. */
export interface Snapshot {
  values: number[];
  notes: number[];
}

/** Partie en cours sur cet appareil : chiffres, notes (masques de bits), erreurs signalées et historique. */
export interface Progress {
  values: number[];
  notes: number[];
  mistakes: number;
  wrong: number;
  /** erreurs déjà comptées, « case:chiffre » (une même erreur ne compte qu'une fois) */
  flagged: string[];
  /** pour annuler et rétablir même en reprenant la partie un autre jour */
  history: Snapshot[];
  future: Snapshot[];
}

/** Historique compact : 81 chiffres puis 81 masques de notes en base 36 sur 2 caractères. */
function encode(s: Snapshot): string {
  return s.values.join("") + s.notes.map((n) => n.toString(36).padStart(2, "0")).join("");
}
function decode(raw: unknown): Snapshot | null {
  if (typeof raw !== "string" || !/^[0-9]{81}[0-9a-z]{162}$/.test(raw)) return null;
  const values = Array.from(raw.slice(0, 81), Number);
  const notes = Array.from({ length: 81 }, (_, i) => parseInt(raw.slice(81 + 2 * i, 83 + 2 * i), 36));
  return { values, notes };
}
function decodeAll(raw: unknown): Snapshot[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.map(decode);
  // historique abîmé : on le perd plutôt que de restaurer n'importe quoi
  return out.every((s): s is Snapshot => s !== null) ? out : [];
}

export function getProgress(day: string): Progress | null {
  try {
    const p = JSON.parse(safeGet(progressKey(day)) ?? "null") as (Omit<Progress, "history" | "future"> & { history?: unknown; future?: unknown }) | null;
    if (!p || !Array.isArray(p.values) || p.values.length !== 81 || !Array.isArray(p.notes) || p.notes.length !== 81) return null;
    return {
      values: p.values.map(Number),
      notes: p.notes.map(Number),
      mistakes: Number(p.mistakes) || 0,
      wrong: Number(p.wrong) || 0,
      flagged: Array.isArray(p.flagged) ? p.flagged.map(String) : [],
      history: decodeAll(p.history),
      future: decodeAll(p.future),
    };
  } catch {
    return null;
  }
}

export function setProgress(day: string, p: Progress) {
  safeSet(progressKey(day), JSON.stringify({ ...p, history: p.history.map(encode), future: p.future.map(encode) }));
}
