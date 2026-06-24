import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// After a new deploy, hashed chunk filenames change and the old ones are
// removed. A browser still running a previous (cached) index.html will fail to
// lazy-load a now-missing chunk ("Failed to fetch dynamically imported module" /
// MIME "text/html"). A plain reload doesn't help because the browser re-serves
// the SAME cached index.html. So we reload with a one-time cache-busting query
// param, which forces a fresh index.html (with the current chunk hashes) from
// the server. A short time-guard prevents a reload loop if the failure is
// genuine (e.g. offline).
function recoverFromStaleChunks() {
  const KEY = "chunk-reload-at";
  const last = Number(sessionStorage.getItem(KEY) || "0");
  if (Date.now() - last < 15000) return; // already tried very recently
  sessionStorage.setItem(KEY, String(Date.now()));
  const url = new URL(window.location.href);
  url.searchParams.set("_v", String(Date.now())); // bust the cached HTML
  window.location.replace(url.toString());
}

window.addEventListener("vite:preloadError", (e) => {
  e.preventDefault();
  recoverFromStaleChunks();
});

// Belt-and-suspenders: catch the same failure when it surfaces as an unhandled
// rejection (e.g. a React.lazy import() that isn't routed through preloadError).
window.addEventListener("unhandledrejection", (e) => {
  const msg = String(e?.reason?.message ?? e?.reason ?? "");
  if (/dynamically imported module|Failed to fetch dynamically|module script/i.test(msg)) {
    recoverFromStaleChunks();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
