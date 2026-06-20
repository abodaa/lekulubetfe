import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { translations, translate } from "../lib/locales";
import { apiFetch } from "../lib/api/client";
import { useAuth } from "../lib/auth/AuthProvider";

function readInitialLang() {
  try {
    const stored = localStorage.getItem("lang");
    if (stored === "en" || stored === "am") return stored;
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (u?.language === "am") return "am";
  } catch {
    /* ignore */
  }
  return "en";
}

const LanguageContext = createContext({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }) {
  const { user } = useAuth();
  // Seed synchronously from the localStorage cache for an instant first paint
  // (no blocking on the network). The server value reconciles in below.
  const [lang, setLangState] = useState(readInitialLang);

  // Server is the source of truth. `localStorage("lang")` is only a cache used
  // for instant first paint. Whenever the profile arrives or changes
  // (user.language, populated by AuthProvider from GET /user/profile), adopt it
  // and refresh the cache. This adds NO extra network request — it rides on the
  // profile fetch AuthProvider already performs. Effect re-runs whenever
  // user.language changes, so a language switched in the Telegram bot shows up
  // here on the next profile load.
  useEffect(() => {
    const serverLang = user?.language;
    if (serverLang !== "en" && serverLang !== "am") return;
    setLangState((cur) => {
      if (cur !== serverLang) {
        try {
          localStorage.setItem("lang", serverLang);
        } catch {
          /* ignore */
        }
      }
      return serverLang;
    });
  }, [user?.language]);

  const setLang = useCallback((next) => {
    const v = next === "am" ? "am" : "en";
    setLangState(v);
    try {
      localStorage.setItem("lang", v);
    } catch {
      /* ignore */
    }
    // Persist to the backend so the bot and app share one preference.
    apiFetch("/user/language", {
      method: "POST",
      body: { language: v },
    }).catch(() => {});
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, translations }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

// Convenience hook when you only need the translate function.
export function useT() {
  return useContext(LanguageContext).t;
}
