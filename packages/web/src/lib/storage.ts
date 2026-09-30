const KEY_SECRET = "sudokurace:secret";
const KEY_CHECK = "sudokurace:check";
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

/** Vérification automatique des doublons (désactivée par défaut). */
export function getCheck(): boolean {
  return safeGet(KEY_CHECK) === "1";
}
export function setCheck(on: boolean) {
  safeSet(KEY_CHECK, on ? "1" : "0");
}

/** Partie en cours sur cet appareil : chiffres, notes (masques de bits) et erreurs signalées. */
export interface Progress {
  values: number[];
  notes: number[];
  mistakes: number;
  /** erreurs déjà comptées, « case:chiffre » (une même erreur ne compte qu'une fois) */
  flagged: string[];
}

export function getProgress(day: string): Progress | null {
  try {
    const p = JSON.parse(safeGet(progressKey(day)) ?? "null") as Progress | null;
    if (!p || !Array.isArray(p.values) || p.values.length !== 81 || !Array.isArray(p.notes) || p.notes.length !== 81) return null;
    return {
      values: p.values.map(Number),
      notes: p.notes.map(Number),
      mistakes: Number(p.mistakes) || 0,
      flagged: Array.isArray(p.flagged) ? p.flagged.map(String) : [],
    };
  } catch {
    return null;
  }
}

export function setProgress(day: string, p: Progress) {
  safeSet(progressKey(day), JSON.stringify(p));
}
