import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isLang, type Lang } from "@sudoku-race/shared";
import { en } from "./en.js";
import { fr, type Strings } from "./fr.js";

const KEY = "sudokurace:lang";
const STRINGS: Record<Lang, Strings> = { fr, en };

/** Langue enregistrée, sinon celle du navigateur (français si l'une des langues préférées l'est). */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* mode privé */
  }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of prefs) {
    const base = l?.slice(0, 2).toLowerCase();
    if (base === "fr") return "fr";
    if (base === "en") return "en";
  }
  return "en";
}

interface I18n {
  lang: Lang;
  t: Strings;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<I18n>({ lang: "fr", t: fr, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo(() => ({ lang, t: STRINGS[lang], setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  return useContext(Ctx);
}

export function useT(): Strings {
  return useContext(Ctx).t;
}
