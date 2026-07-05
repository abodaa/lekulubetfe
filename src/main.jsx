import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Keep --app-height in sync with the ACTUAL usable viewport height so full-height
// screens fit exactly inside Telegram's WebView (the real fix for the 100vh
// cut-off, the on-screen keyboard, and address-bar resizes on mobile browsers).
function setAppHeight() {
  const tg = window?.Telegram?.WebApp;
  // Telegram restores a minimized Mini App in a COLLAPSED state, which shrinks
  // viewportStableHeight and, because the game layout uses a fixed
  // h-[var(--app-height)] column, collapses everything below the header.
  // Re-expand so Telegram reports the full height again.
  try {
    if (tg && tg.isExpanded === false) tg.expand();
  } catch (e) {
    console.error("Error occurred while expanding Telegram WebApp:", e);
  }
  const h =
    (tg && (tg.viewportStableHeight || tg.viewportHeight)) ||
    window.innerHeight;
  // Ignore transient tiny/zero heights reported mid-collapse so we never shrink
  // the layout; a correct viewportChanged fires right after expand() completes.
  if (h && h > 200) {
    document.documentElement.style.setProperty("--app-height", `${h}px`);
  }
}

// Mark ready + expand on first load.
try {
  const tg = window?.Telegram?.WebApp;
  tg?.ready?.();
  tg?.expand?.();
} catch (e) {
  /* not in Telegram */
  console.error("Error occurred while initializing Telegram WebApp:", e);
}

setAppHeight();
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", setAppHeight);
// Re-measure (and re-expand) when the app is brought back to the foreground —
// this is the minimize → restore case where the content was collapsing.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    setAppHeight();
    // Second pass after Telegram finishes its expand/resize animation.
    setTimeout(setAppHeight, 300);
  }
});
try {
  window?.Telegram?.WebApp?.onEvent?.("viewportChanged", setAppHeight);
} catch (e) {
  /* not in Telegram; resize listener is enough */
  console.error("Error occurred while setting viewportChanged listener:", e);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
