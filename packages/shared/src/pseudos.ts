/**
 * Pseudos tirés au hasard à la création du profil : un animal et un adjectif,
 * dans la langue du joueur. Modifiables ensuite (20 caractères au plus).
 */
export const MAX_PSEUDO_LENGTH = 20;
export const LANGS = ["fr", "en"] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(s: unknown): s is Lang {
  return typeof s === "string" && (LANGS as readonly string[]).includes(s);
}

/** [nom, féminin ?] */
const ANIMALS_FR: readonly (readonly [string, boolean])[] = [
  ["flamant", false],
  ["ragondin", false],
  ["héron", false],
  ["taureau", false],
  ["cheval", false],
  ["blaireau", false],
  ["cormoran", false],
  ["castor", false],
  ["sanglier", false],
  ["cafard", false],
  ["tardigrade", false],
  ["ornithorynque", false],
  ["lamantin", false],
  ["pangolin", false],
  ["dindon", false],
  ["hérisson", false],
  ["ouistiti", false],
  ["goéland", false],
  ["mouette", true],
  ["crapaud", false],
];

/** [masculin, féminin] */
const ADJECTIVES_FR: readonly (readonly [string, string])[] = [
  ["flemmard", "flemmarde"],
  ["cosmique", "cosmique"],
  ["mélancolique", "mélancolique"],
  ["louche", "louche"],
  ["suspect", "suspecte"],
  ["zen", "zen"],
  ["sceptique", "sceptique"],
  ["dramatique", "dramatique"],
  ["sournois", "sournoise"],
  ["distrait", "distraite"],
  ["pompeux", "pompeuse"],
  ["fébrile", "fébrile"],
  ["nocturne", "nocturne"],
  ["moustachu", "moustachue"],
  ["philosophe", "philosophe"],
];

const ANIMALS_EN = [
  "Flamingo",
  "Coypu",
  "Heron",
  "Bull",
  "Horse",
  "Badger",
  "Cormorant",
  "Beaver",
  "Boar",
  "Cockroach",
  "Tardigrade",
  "Platypus",
  "Manatee",
  "Pangolin",
  "Turkey",
  "Hedgehog",
  "Marmoset",
  "Gull",
  "Kittiwake",
  "Toad",
] as const;

const ADJECTIVES_EN = [
  "Lazy",
  "Cosmic",
  "Melancholy",
  "Shady",
  "Suspicious",
  "Zen",
  "Skeptical",
  "Dramatic",
  "Sneaky",
  "Distracted",
  "Pompous",
  "Feverish",
  "Nocturnal",
  "Mustachioed",
  "Philosophical",
] as const;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function pick<T>(list: readonly T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)]!;
}

/** Toutes les combinaisons possibles qui tiennent dans la limite (pour les tests). */
export function allPseudos(lang: Lang): string[] {
  const out: string[] = [];
  if (lang === "fr") {
    for (const [animal, fem] of ANIMALS_FR) for (const [m, f] of ADJECTIVES_FR) out.push(`${cap(animal)} ${fem ? f : m}`);
  } else {
    for (const animal of ANIMALS_EN) for (const adj of ADJECTIVES_EN) out.push(`${adj} ${animal}`);
  }
  return out.filter((p) => p.length <= MAX_PSEUDO_LENGTH);
}

/** « Ragondin cosmique », « Cosmic Coypu »… toujours ≤ 20 caractères. */
export function randomPseudo(lang: Lang, rand: () => number = Math.random): string {
  for (;;) {
    let p: string;
    if (lang === "fr") {
      const [animal, fem] = pick(ANIMALS_FR, rand);
      const [m, f] = pick(ADJECTIVES_FR, rand);
      p = `${cap(animal)} ${fem ? f : m}`;
    } else {
      p = `${pick(ADJECTIVES_EN, rand)} ${pick(ANIMALS_EN, rand)}`;
    }
    if (p.length <= MAX_PSEUDO_LENGTH) return p;
  }
}

/** Ajoute « 2 », « 37 »… en cas de doublon, sans dépasser la limite. */
export function withNumber(pseudo: string, n: number): string {
  const suffix = ` ${n}`;
  return pseudo.slice(0, MAX_PSEUDO_LENGTH - suffix.length).trimEnd() + suffix;
}

export function sanitizePseudo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const p = raw
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!p || [...p].length > MAX_PSEUDO_LENGTH) return null;
  return p;
}
