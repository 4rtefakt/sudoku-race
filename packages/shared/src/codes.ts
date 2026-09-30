/** Code ami : 6 caractères sans les signes ambigus (I, L, O, 0, 1). */
export const FRIEND_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const FRIEND_CODE_LENGTH = 6;

/** Majuscules, espaces et tirets retirés ; null si le code n'est pas valide. */
export function normalizeFriendCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== FRIEND_CODE_LENGTH) return null;
  for (const ch of code) if (!FRIEND_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** Secret de transfert : 32 octets en base64url (43 caractères). */
export function isSecret(s: unknown): s is string {
  return typeof s === "string" && /^[A-Za-z0-9_-]{43}$/.test(s);
}
