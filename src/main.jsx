import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Keep --app-height in sync with the ACTUAL usable viewport height so full-height
// screens fit exactly inside Telegram's WebView (the real fix for the 100vh
// cut-off, the on-screen keyboard, and address-bar resizes on mobile browsers).
function setAppHeight() {
  const tg = window?.Telegram?.WebApp
  const h = (tg && tg.viewportStableHeight) || window.innerHeight
  if (h) {
    document.documentElement.style.setProperty('--app-height', `${h}px`)
  }
}

setAppHeight()
window.addEventListener('resize', setAppHeight)
window.addEventListener('orientationchange', setAppHeight)
try {
  window?.Telegram?.WebApp?.onEvent?.('viewportChanged', setAppHeight)
} catch (e) {
  /* not in Telegram; resize listener is enough */
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)