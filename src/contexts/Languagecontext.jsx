import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { translations, translate } from "../lib/locales";
import { apiFetch } from "../lib/api/client";

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
  const [lang, setLangState] = useState(readInitialLang);

  // If the profile loads later with a language and the user hasn't made an
  // explicit choice this session, adopt the server value.
  useEffect(() => {
    if (localStorage.getItem("lang")) return;
    try {
      const u = JSON.parse(localStorage.getItem("user") || "null");
      if (u?.language === "am" || u?.language === "en")
        setLangState(u.language);
    } catch {
      /* ignore */
    }
    // re-run when the cached user changes is not observable here; this runs once
    // on mount, which is enough because the switcher persists explicit choices.
  }, []);

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

