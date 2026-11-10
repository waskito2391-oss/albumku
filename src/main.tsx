import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import { initTheme } from "./lib/theme";

initTheme();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// hook uji otomatis (hanya mode dev)
if (import.meta.env.DEV) {
  Promise.all([import("./store"), import("./lib/actions"), import("./lib/api"), import("./lib/formats")]).then(([store, actions, api, formats]) => {
    (window as any).__ak = { store, actions, api, formats };
  });
}
