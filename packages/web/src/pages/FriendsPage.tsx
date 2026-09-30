import { useState } from "react";
import { normalizeFriendCode, type Friend } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { api, ApiError, links } from "../lib/api.js";
import { copyText, shareOrCopy } from "../lib/share.js";
import { useApi } from "../hooks/useApi.js";
import { useIdentity } from "../hooks/useIdentity.js";
import { ShareIcon } from "../components/Icons.js";

export function FriendsPage() {
  const t = useT();
  const { profile } = useIdentity();
  const friends = useApi(() => api.friends(), []);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const inviteUrl = links.invite(profile.friendCode);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = normalizeFriendCode(code);
    if (!c) return setMsg({ text: t.invalidCode, error: true });
    if (c === profile.friendCode) return setMsg({ text: t.selfCode, error: true });
    setBusy(true);
    try {
      const r = await api.addFriend(c);
      setMsg({ text: r.already ? t.alreadyFriend(r.friend.pseudo) : t.friendAdded(r.friend.pseudo), error: false });
      setCode("");
      friends.reload();
    } catch (err) {
      setMsg({ text: err instanceof ApiError && err.status === 404 ? t.unknownCode : err instanceof ApiError && err.code === "self" ? t.selfCode : t.networkError, error: true });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (f: Friend) => {
    if (!window.confirm(t.removeConfirm(f.pseudo))) return;
    try {
      await api.removeFriend(f.friendCode);
      friends.reload();
    } catch {
      setMsg({ text: t.networkError, error: true });
    }
  };

  const copy = async (what: string, text: string) => {
    if (await copyText(text)) {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <main className="page narrow-page">
      <h1>{t.friendsTitle}</h1>
      <p className="muted">{t.friendsIntro}</p>

      <section className="card">
        <h2>{t.yourCode}</h2>
        <div className="code-row">
          <strong className="friend-code">{profile.friendCode}</strong>
          <button type="button" onClick={() => void copy("code", profile.friendCode)}>
            {copied === "code" ? t.copied : t.copy}
          </button>
        </div>
        <h2>{t.inviteLink}</h2>
        <div className="code-row">
          <code className="link">{inviteUrl}</code>
        </div>
        <div className="row wrap">
          <button type="button" className="primary icon-btn" onClick={() => void shareOrCopy({ text: t.inviteText, url: inviteUrl }).then((r) => r === "copied" && setCopied("link"))}>
            <ShareIcon />
            {t.share}
          </button>
          <button type="button" onClick={() => void copy("link", inviteUrl)}>
            {copied === "link" ? t.copied : t.copy}
          </button>
        </div>
        <p className="muted small">{t.inviteHint}</p>
      </section>

      <section className="card">
        <form className="field" onSubmit={onAdd}>
          <label htmlFor="friend-code">{t.addByCode}</label>
          <div className="row">
            <input
              id="friend-code"
              className="code-input"
              value={code}
              placeholder={t.codePlaceholder}
              maxLength={7}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              aria-invalid={msg?.error || undefined}
              aria-describedby={msg ? "friend-msg" : undefined}
            />
            <button type="submit" className="primary" disabled={busy || code.replace(/[\s-]/g, "").length < 6}>
              {t.add}
            </button>
          </div>
        </form>
        {msg && (
          <p id="friend-msg" className={msg.error ? "error" : "ok"} role={msg.error ? "alert" : "status"}>
            {msg.text}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="friends-list">
        <h2 id="friends-list">{t.friends}</h2>
        {!friends.data ? (
          <p className="muted">{friends.error ? t.networkError : t.loading}</p>
        ) : friends.data.friends.length === 0 ? (
          <p className="muted">{t.noFriends}</p>
        ) : (
          <ul className="friend-list">
            {friends.data.friends.map((f) => (
              <li key={f.friendCode}>
                <div>
                  <span className="who">{f.pseudo}</span>
                  <span className={`small ${f.mutual ? "ok" : "muted"}`}>{f.mutual ? t.mutual : t.notMutual}</span>
                </div>
                <button type="button" className="subtle" onClick={() => void onRemove(f)} aria-label={`${t.remove} ${f.pseudo}`}>
                  {t.remove}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
