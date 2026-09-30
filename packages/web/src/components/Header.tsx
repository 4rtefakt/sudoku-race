import { useState } from "react";
import { useT } from "../i18n/index.js";
import { usePath } from "../lib/router.js";
import { HelpDialog } from "./HelpDialog.js";
import { GearIcon, HelpIcon, Logo, UsersIcon } from "./Icons.js";
import { Link } from "./Link.js";

export function Header() {
  const t = useT();
  const path = usePath();
  const [help, setHelp] = useState(false);
  return (
    <header className="topbar">
      <Link href="/" className="brand" aria-label={`${t.appName} — ${t.home}`}>
        <Logo />
        <span>{t.appName}</span>
      </Link>
      <nav className="actions">
        <button type="button" className="icon-btn subtle" onClick={() => setHelp(true)} aria-haspopup="dialog" title={t.help}>
          <HelpIcon />
          <span className="btn-label">{t.help}</span>
        </button>
        <Link href="/friends" className={`icon-btn nav-link${path === "/friends" ? " on" : ""}`} aria-current={path === "/friends" ? "page" : undefined} title={t.friends}>
          <UsersIcon />
          <span className="btn-label">{t.friends}</span>
        </Link>
        <Link href="/settings" className={`icon-btn nav-link${path === "/settings" ? " on" : ""}`} aria-current={path === "/settings" ? "page" : undefined} title={t.settings}>
          <GearIcon />
          <span className="btn-label">{t.settings}</span>
        </Link>
      </nav>
      <HelpDialog open={help} onClose={() => setHelp(false)} />
    </header>
  );
}
