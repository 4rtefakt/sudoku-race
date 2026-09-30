import { useEffect, useState } from "react";
import { normalizeFriendCode, type AddFriendResponse } from "@sudoku-race/shared";
import { useT } from "../i18n/index.js";
import { api, ApiError, links } from "../lib/api.js";
import { shareOrCopy } from "../lib/share.js";
import { useIdentity } from "../hooks/useIdentity.js";
import { Link } from "../components/Link.js";
import { ShareIcon } from "../components/Icons.js";

const adding = new Map<string, Promise<AddFriendResponse>>();

/** /add/<code> : ajoute le joueur à ma liste et le confirme. */
export function AddFriendPage({ rawCode }: { rawCode: string }) {
  const t = useT();
  const { profile } = useIdentity();
  const code = normalizeFriendCode(rawCode);
  const [state, setState] = useState<{ ok: true; name: string; already: boolean } | { ok: false; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return setState({ ok: false, text: t.invalidCode });
    if (code === profile.friendCode) return setState({ ok: false, text: t.selfCode });
    let p = adding.get(code);
    if (!p) adding.set(code, (p = api.addFriend(code)));
    let alive = true;
    p.then(
      (r) => alive && setState({ ok: true, name: r.friend.pseudo, already: r.already }),
      (e) => alive && setState({ ok: false, text: e instanceof ApiError && e.status === 404 ? t.unknownCode : t.networkError }),
    );
    return () => {
      alive = false;
    };
  }, [code, profile.friendCode, t]);

  return (
    <main className="page narrow-page">
      <h1>{t.addTitle}</h1>
      {!state ? (
        <p className="muted">{t.loading}</p>
      ) : state.ok ? (
        <section className="card">
          <p className="big-line">{state.already ? t.alreadyFriend(state.name) : t.addDone(state.name)}</p>
          <p className="muted">{t.addBack}</p>
          <div className="row wrap">
            <Link href="/" className="button primary">
              {t.play}
            </Link>
            <button
              type="button"
              className="icon-btn"
              onClick={() => void shareOrCopy({ text: t.inviteText, url: links.invite(profile.friendCode) }).then((r) => r === "copied" && setCopied(true))}
            >
              <ShareIcon />
              {copied ? t.linkCopied : t.sendMyLink}
            </button>
          </div>
        </section>
      ) : (
        <section className="card">
          <p role="alert">{state.text}</p>
          <div className="row wrap">
            <Link href="/friends" className="button">
              {t.friends}
            </Link>
            <Link href="/" className="button primary">
              {t.play}
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
