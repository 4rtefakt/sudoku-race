import { useEffect, useState } from "react";
import { isSecret, type Profile } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { adoptSecret, api, currentSecret } from "../lib/api.js";
import { navigate } from "../lib/router.js";
import { useIdentity } from "../hooks/useIdentity.js";
import { Link } from "../components/Link.js";

/**
 * /restore#<secret> : ouvert en scannant le QR code des réglages. Le secret est
 * dans le fragment, qui ne part jamais au serveur ni dans ses journaux.
 */
export function RestorePage() {
  const t = useT();
  const { profile, setProfile, restoredFromLink } = useIdentity();
  const [secret] = useState(() => window.location.hash.slice(1));
  const [state, setState] = useState<{ kind: "confirm"; profile: Profile } | { kind: "done"; name: string } | { kind: "msg"; text: string } | null>(null);

  useEffect(() => {
    // le secret ne reste pas dans la barre d'adresse ni dans l'historique
    window.history.replaceState(null, "", "/restore");
    if (!isSecret(secret)) return setState({ kind: "msg", text: t.restoreInvalid });
    if (restoredFromLink && secret === currentSecret()) return setState({ kind: "done", name: profile.pseudo });
    if (secret === currentSecret()) return setState({ kind: "msg", text: t.restoreSame });
    api.me(secret).then(
      (p) => setState({ kind: "confirm", profile: p }),
      () => setState({ kind: "msg", text: t.restoreUnknown }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="page narrow-page">
      <h1>{t.restoreTitle}</h1>
      <section className="card">
        {!state && <p className="muted">{t.loading}</p>}
        {state?.kind === "msg" && <p role="alert">{state.text}</p>}
        {state?.kind === "done" && <p className="big-line">{t.restoreDone(state.name)}</p>}
        {state?.kind === "confirm" && (
          <>
            <p>{t.restoreConfirm(state.profile.pseudo)}</p>
            <div className="row wrap">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  adoptSecret(secret);
                  setProfile(state.profile);
                  setState({ kind: "done", name: state.profile.pseudo });
                }}
              >
                {t.confirm}
              </button>
              <button type="button" onClick={() => navigate("/")}>
                {t.cancel}
              </button>
            </div>
          </>
        )}
        {state && state.kind !== "confirm" && (
          <div className="row wrap">
            <Link href="/" className="button primary">
              {t.play}
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
