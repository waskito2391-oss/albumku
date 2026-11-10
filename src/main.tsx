import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LicenseGate } from "./components/LicenseGate";
import { UpdateNotice } from "./components/UpdateNotice";
import "./index.css";
import { initTheme } from "./lib/theme";

initTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <LicenseGate>
        <App />
        <UpdateNotice />
      </LicenseGate>
    </ErrorBoundary>
  </React.StrictMode>,
);

// hook uji otomatis (hanya mode dev)
if (import.meta.env.DEV) {
  Promise.all([import("./store"), import("./lib/actions"), import("./lib/api"), import("./lib/formats")]).then(([store, actions, api, formats]) => {
    (window as any).__ak = { store, actions, api, formats };
  });
}
