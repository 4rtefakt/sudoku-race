import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { isSecret, type Profile } from "@sudoku-race/shared";
import { useI18n } from "../i18n/index.js";
import { adoptSecret, api, ApiError, currentSecret } from "../lib/api.js";

interface Identity {
  profile: Profile;
  setProfile: (p: Profile) => void;
  /** profil repris depuis un lien /restore#… à l'ouverture (appareil encore vierge) */
  restoredFromLink: boolean;
}

const Ctx = createContext<Identity | null>(null);

/** Un seul appel même si React monte l'effet deux fois (StrictMode). */
let pending: Promise<{ profile: Profile; restored: boolean }> | null = null;

async function ensureIdentity(lang: "fr" | "en"): Promise<{ profile: Profile; restored: boolean }> {
  const stored = currentSecret();
  if (stored) {
    try {
      return { profile: await api.me(stored), restored: false };
    } catch (e) {
      // secret inconnu du serveur (base réinitialisée) : on repart d'un profil neuf
      if (!(e instanceof ApiError) || e.status !== 401) throw e;
    }
  } else if (window.location.pathname === "/restore") {
    // appareil vierge qui ouvre un lien de transfert : rien à perdre, on reprend directement ce profil
    const secret = window.location.hash.slice(1);
    if (isSecret(secret)) {
      try {
        const profile = await api.me(secret);
        adoptSecret(secret);
        return { profile, restored: true };
      } catch {
        /* code invalide : profil neuf */
      }
    }
  }
  const created = await api.createPlayer(lang);
  adoptSecret(created.secret);
  return { profile: { pseudo: created.pseudo, friendCode: created.friendCode }, restored: false };
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { lang, t } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [restoredFromLink, setRestored] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    pending ??= ensureIdentity(lang);
    pending.then(
      (r) => {
        setProfile(r.profile);
        setRestored(r.restored);
      },
      () => {
        pending = null;
        setFailed(true);
      },
    );
    // la langue ne sert qu'au tout premier pseudo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(load, [load]);

  if (failed)
    return (
      <main className="page center">
        <p role="alert">{t.networkError}</p>
        <button type="button" className="primary" onClick={load}>
          {t.retry}
        </button>
      </main>
    );
  if (!profile)
    return (
      <main className="page center" aria-busy="true">
        <p className="muted">{t.loading}</p>
      </main>
    );
  return <Ctx.Provider value={{ profile, setProfile, restoredFromLink }}>{children}</Ctx.Provider>;
}

export function useIdentity(): Identity {
  const v = useContext(Ctx);
  if (!v) throw new Error("useIdentity hors IdentityProvider");
  return v;
}
