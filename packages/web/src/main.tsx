import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { I18nProvider } from "./i18n/index.js";
import { IdentityProvider } from "./hooks/useIdentity.js";
import { initTheme } from "./lib/theme.js";
import "./styles.css";

initTheme();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <IdentityProvider>
        <App />
      </IdentityProvider>
    </I18nProvider>
  </React.StrictMode>,
);
