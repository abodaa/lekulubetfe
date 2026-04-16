import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext({
  sessionId: null,
  user: null,
  setSessionId: () => {},
  isLoading: true,
});

/**
 * Backend Verification Call
 * Sends the Telegram initData to your server to validate the hash.
 */
async function verifyTelegram(initData) {
  const apiBase =
    import.meta.env.VITE_API_URL ||
    (window.location.hostname === "localhost"
      ? "http://localhost:3001"
      : "https://markbingo.com");

  const res = await fetch(`${apiBase}/api/auth/telegram/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  if (!res.ok) throw new Error(`Auth failed with status: ${res.status}`);
  return await res.json();
}

/**
 * JWT Expiry Check
 * Checks if the session stored in LocalStorage is actually still valid.
 */
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [sessionId, setSessionId] = useState(() =>
    localStorage.getItem("sessionId"),
  );
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Wait for Telegram WebApp SDK to initialize
        let attempts = 0;
        while (attempts < 10 && !window?.Telegram?.WebApp) {
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }

        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
        }

        // 2. Identify initData from SDK or URL (Hash/Search)
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const searchParams = new URLSearchParams(window.location.search);

        const initData =
          window.Telegram?.WebApp?.initData ||
          hashParams.get("tgWebAppData") ||
          searchParams.get("tgWebAppData");

        // 3. PRIORITY 1: Fresh Telegram Session
        if (initData && initData.trim() !== "") {
          const out = await verifyTelegram(initData);

          if (out?.sessionId) {
            setSessionId(out.sessionId);
            setUser(out.user);
            localStorage.setItem("sessionId", out.sessionId);
            localStorage.setItem("user", JSON.stringify(out.user));
            setIsLoading(false);
            return;
          }
        }

        // 4. PRIORITY 2: Local Session Fallback
        const localSess = localStorage.getItem("sessionId");
        const localUser = JSON.parse(localStorage.getItem("user") || "null");

        if (localSess && localUser && !isTokenExpired(localSess)) {
          setSessionId(localSess);
          setUser(localUser);
          setIsLoading(false);
          return;
        }

        // 5. FAIL: No valid data sources found
        clearAuth();
      } catch (err) {
        console.error("Authentication crash:", err);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    const clearAuth = () => {
      localStorage.removeItem("sessionId");
      localStorage.removeItem("user");
      setSessionId(null);
      setUser(null);
    };

    initAuth();
  }, []);

  const value = useMemo(
    () => ({
      sessionId,
      user,
      setSessionId,
      isLoading,
    }),
    [sessionId, user, isLoading],
  );

  // UI Logic: Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e6e6fa]">
        <div className="text-center">
          <img
            src="/lb.png"
            alt="Logo"
            className="w-20 h-20 animate-pulse mx-auto mb-4"
          />
          <p className="text-white font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  // UI Logic: Access Restricted (The "Gate")
  if (!sessionId || !user) {
    return (
      <div className="min-h-screen bg-purple-900 flex items-center justify-center p-8 text-center">
        <div className="max-w-xs">
          <div className="text-5xl mb-6">🚫</div>
          <h1 className="text-white text-2xl font-bold mb-4">
            Access Restricted
          </h1>
          <p className="text-white/70 text-sm leading-relaxed">
            To play, please open this link from your Telegram bot.
          </p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
