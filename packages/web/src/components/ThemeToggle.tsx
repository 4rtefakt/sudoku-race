import { useState } from "react";
import { useI18n, useT } from "../i18n/index.js";
import { applyTheme, getTheme, type Theme } from "../lib/theme.js";

export function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState<Theme>(getTheme());
  const options: { value: Theme; label: string; glyph: string }[] = [
    { value: "auto", label: t.themeAuto, glyph: "◐" },
    { value: "light", label: t.themeLight, glyph: "○" },
    { value: "dark", label: t.themeDark, glyph: "●" },
  ];
  return (
    <div className="seg" role="radiogroup" aria-label={t.theme}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          className={theme === o.value ? "on" : ""}
          onClick={() => {
            setTheme(o.value);
            applyTheme(o.value);
          }}
          title={o.label}
        >
          <span aria-hidden>{o.glyph}</span>
          <span className="seg-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="seg" role="radiogroup" aria-label={t.language}>
      {(["fr", "en"] as const).map((l) => (
        <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? "on" : ""} onClick={() => setLang(l)} lang={l}>
          {l === "fr" ? "Français" : "English"}
        </button>
      ))}
    </div>
  );
}
