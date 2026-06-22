import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// After a new deploy, hashed chunk filenames change and the old ones are
// removed. A browser still running the previous index.html will fail to lazy-
// load a now-missing chunk ("Failed to fetch dynamically imported module" /
// MIME "text/html"). Vite fires `vite:preloadError` in that case — reload once
// to pick up the fresh index.html and current chunks. A sessionStorage guard
// prevents a reload loop if the failure is genuine (e.g. offline).
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("chunk-reload") === "1") return;
  sessionStorage.setItem("chunk-reload", "1");
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
