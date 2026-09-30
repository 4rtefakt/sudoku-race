import { useState } from "react";
import { isSecret, MAX_PSEUDO_LENGTH, sanitizePseudo } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { adoptSecret, api, ApiError, currentSecret, links } from "../lib/api.js";
import { copyText } from "../lib/share.js";
import { getCheck, setCheck } from "../lib/storage.js";
import { useIdentity } from "../hooks/useIdentity.js";
import { LangToggle, ThemeToggle } from "../components/ThemeToggle.js";
import { QrCode } from "../components/QrCode.js";
import { Link } from "../components/Link.js";

/** Code de transfert collé tel quel ou sous forme de lien …/restore#code. */
export function extractSecret(raw: string): string | null {
  const s = raw.trim();
  const candidate = s.includes("#") ? s.slice(s.lastIndexOf("#") + 1) : s;
  return isSecret(candidate) ? candidate : null;
}

export function SettingsPage() {
  const t = useT();
  const { profile, setProfile } = useIdentity();
  const [pseudo, setPseudo] = useState(profile.pseudo);
  const [pseudoMsg, setPseudoMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [check, setCheckState] = useState(getCheck);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restore, setRestore] = useState("");
  const [restoreMsg, setRestoreMsg] = useState<{ text: string; error: boolean } | null>(null);

  const secret = currentSecret() ?? "";

  const savePseudo = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizePseudo(pseudo);
    if (!clean) return setPseudoMsg({ text: t.badPseudo, error: true });
    try {
      const p = await api.rename(clean);
      setProfile(p);
      setPseudo(p.pseudo);
      setPseudoMsg({ text: t.saved, error: false });
    } catch (err) {
      setPseudoMsg({ text: err instanceof ApiError && err.code === "bad_pseudo" ? t.badPseudo : t.networkError, error: true });
    }
  };

  const doRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = extractSecret(restore);
    if (!s) return setRestoreMsg({ text: t.restoreInvalid, error: true });
    if (s === secret) return setRestoreMsg({ text: t.restoreSame, error: false });
    try {
      const p = await api.me(s);
      if (!window.confirm(t.restoreConfirm(p.pseudo))) return;
      adoptSecret(s);
      setProfile(p);
      setPseudo(p.pseudo);
      setRestore("");
      setShowSecret(false);
      setRestoreMsg({ text: t.restoreDone(p.pseudo), error: false });
    } catch (err) {
      setRestoreMsg({ text: err instanceof ApiError && err.status === 401 ? t.restoreUnknown : t.networkError, error: true });
    }
  };

  return (
    <main className="page narrow-page">
      <h1>{t.settingsTitle}</h1>

      <section className="card">
        <form className="field" onSubmit={savePseudo}>
          <label htmlFor="pseudo">{t.pseudo}</label>
          <div className="row">
            <input
              id="pseudo"
              value={pseudo}
              maxLength={MAX_PSEUDO_LENGTH}
              autoComplete="nickname"
              onChange={(e) => {
                setPseudo(e.target.value);
                setPseudoMsg(null);
              }}
              aria-describedby="pseudo-hint"
              aria-invalid={pseudoMsg?.error || undefined}
            />
            <button type="submit" className="primary" disabled={pseudo.trim() === profile.pseudo}>
              {t.save}
            </button>
          </div>
          <p id="pseudo-hint" className={`small ${pseudoMsg ? (pseudoMsg.error ? "error" : "ok") : "muted"}`} role="status">
            {pseudoMsg?.text ?? t.pseudoHint}
          </p>
        </form>
        <p className="small">
          {t.yourCode} <strong className="friend-code small-code">{profile.friendCode}</strong> · <Link href="/friends">{t.inviteLink}</Link>
        </p>
      </section>

      <section className="card">
        <div className="field">
          <span className="label">{t.language}</span>
          <LangToggle />
        </div>
        <div className="field">
          <span className="label">{t.theme}</span>
          <ThemeToggle />
        </div>
        <label className="switch">
          <input
            type="checkbox"
            checked={check}
            onChange={(e) => {
              setCheckState(e.target.checked);
              setCheck(e.target.checked);
            }}
          />
          <span>
            <strong>{t.checkDefault}</strong>
            <span className="muted small">{t.checkDefaultHint}</span>
          </span>
        </label>
      </section>

      <section className="card" aria-labelledby="transfer-title">
        <h2 id="transfer-title">{t.transfer}</h2>
        <p className="muted">{t.transferIntro}</p>
        {!showSecret ? (
          <button type="button" onClick={() => setShowSecret(true)}>
            {t.showCode}
          </button>
        ) : (
          <div className="transfer">
            <QrCode text={links.restore(secret)} label={t.qrHint} />
            <p className="muted small">{t.qrHint}</p>
            <code className="secret">{secret}</code>
            <div className="row wrap">
              <button
                type="button"
                onClick={() =>
                  void copyText(secret).then((ok) => {
                    if (!ok) return;
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  })
                }
              >
                {copied ? t.copied : t.copy}
              </button>
              <button type="button" className="subtle" onClick={() => setShowSecret(false)}>
                {t.hideCode}
              </button>
            </div>
            <p className="warn small">{t.transferWarning}</p>
          </div>
        )}

        <form className="field restore" onSubmit={doRestore}>
          <label htmlFor="restore">{t.restore}</label>
          <p className="muted small">{t.restoreHint}</p>
          <div className="row">
            <input id="restore" value={restore} placeholder={t.restorePlaceholder} autoComplete="off" spellCheck={false} onChange={(e) => setRestore(e.target.value)} />
            <button type="submit" disabled={!restore.trim()}>
              {t.restoreButton}
            </button>
          </div>
          {restoreMsg && (
            <p className={restoreMsg.error ? "error" : "ok"} role={restoreMsg.error ? "alert" : "status"}>
              {restoreMsg.text}
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
