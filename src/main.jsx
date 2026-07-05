import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

// Keep --app-height in sync with the ACTUAL usable viewport height so full-height
// screens fit exactly inside Telegram's WebView (the real fix for the 100vh
// cut-off, the on-screen keyboard, and address-bar resizes on mobile browsers).
function readViewportHeight() {
  const tg = window?.Telegram?.WebApp;
  // Prefer Telegram's stable height (excludes the area obscured by its UI, which
  // was the original 100vh cut-off fix); fall back to viewportHeight, then the
  // WebView's own innerHeight.
  return (
    (tg && (tg.viewportStableHeight || tg.viewportHeight)) || window.innerHeight
  );
}

function setAppHeight() {
  const h = readViewportHeight();
  // Ignore transient tiny/zero heights reported mid-collapse so we never shrink
  // the layout to nothing.
  if (h && h > 200) {
    document.documentElement.style.setProperty("--app-height", `${h}px`);
  }
}

// Force Telegram to (re)expand and re-measure. Telegram restores a minimized
// Mini App collapsed and OFTEN still reports isExpanded === true, so we must
// call expand() UNCONDITIONALLY. Expansion is async, so we re-measure a few
// times to catch the height once the WebView finishes resizing.
function expandAndMeasure() {
  const tg = window?.Telegram?.WebApp;
  try {
    tg?.expand?.();
  } catch (e) {
    /* not in Telegram */
  }
  setAppHeight();
  setTimeout(setAppHeight, 150);
  setTimeout(setAppHeight, 400);
  setTimeout(setAppHeight, 800);
}

try {
  window?.Telegram?.WebApp?.ready?.();
} catch (e) {
  /* not in Telegram */
}

expandAndMeasure();
window.addEventListener("resize", setAppHeight);
window.addEventListener("orientationchange", expandAndMeasure);
// The minimize → restore case: the app comes back collapsed, so re-expand and
// re-measure whenever it returns to the foreground.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") expandAndMeasure();
});
window.addEventListener("focus", expandAndMeasure);
try {
  window?.Telegram?.WebApp?.onEvent?.("viewportChanged", setAppHeight);
} catch (e) {
  /* not in Telegram; resize listener is enough */
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
