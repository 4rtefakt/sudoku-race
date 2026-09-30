import { isDayKey } from "@sudoku-race/shared";
import { useT } from "./i18n/index.js";
import { usePath } from "./lib/router.js";
import { Header } from "./components/Header.js";
import { DayPage } from "./pages/DayPage.js";
import { FriendsPage } from "./pages/FriendsPage.js";
import { AddFriendPage } from "./pages/AddFriendPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { RestorePage } from "./pages/RestorePage.js";

function route(path: string) {
  let m = path.match(/^\/(\d{4}-\d{2}-\d{2})\/vs\/([A-Za-z0-9-]+)\/?$/);
  if (m && isDayKey(m[1])) return <DayPage day={m[1]} duel={m[2]!.toUpperCase().replace(/-/g, "")} />;
  m = path.match(/^\/(\d{4}-\d{2}-\d{2})\/?$/);
  if (m && isDayKey(m[1])) return <DayPage day={m[1]} />;
  m = path.match(/^\/add\/([A-Za-z0-9-]+)\/?$/);
  if (m) return <AddFriendPage key={m[1]} rawCode={m[1]!} />;
  if (path === "/friends") return <FriendsPage />;
  if (path === "/settings") return <SettingsPage />;
  if (path === "/restore") return <RestorePage />;
  return <DayPage />;
}

export function App() {
  const t = useT();
  const path = usePath();
  return (
    <>
      <a className="skip" href="#play">
        {t.skipToGrid}
      </a>
      <Header />
      {route(path)}
      <footer>
        <small className="muted">{t.footer}</small>
      </footer>
    </>
  );
}
