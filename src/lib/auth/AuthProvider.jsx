import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "../api/client";

const AuthContext = createContext({
  sessionId: null,
  user: null,
  setSessionId: () => {},
  isLoading: true,
});

// Helper: Verify Telegram Data with Backend
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

  if (!res.ok) throw new Error("verify_failed");
  return await res.json();
}

// Helper: Token Expiry Check
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

async function fetchProfileWithSession(sessionId) {
  if (!sessionId) return null;
  try {
    return await apiFetch("/user/profile", { sessionId });
  } catch {
    return null;
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
        // 1. POLLING: Wait for the Telegram SDK to inject WebApp
        let attempts = 0;
        while (attempts < 15 && !window?.Telegram?.WebApp) {
          await new Promise((r) => setTimeout(r, 500));
          attempts++;
        }

        const WebApp = window?.Telegram?.WebApp;
        if (WebApp) {
          WebApp.ready();
          WebApp.expand();
        }

        // 2. EXTRACT: Check SDK, then URL Hash, then URL Search
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const searchParams = new URLSearchParams(window.location.search);

        const initData =
          WebApp?.initData && WebApp.initData.trim() !== ""
            ? WebApp.initData
            : hashParams.get("tgWebAppData") ||
              searchParams.get("tgWebAppData");

        // 3. LOGIC BRANCH A: Fresh Telegram Session
        if (initData && initData.trim() !== "") {
          const out = await verifyTelegram(initData);

          if (out?.sessionId) {
            // User Switching Safety: Clear old user if IDs don't match
            const prevUser = JSON.parse(localStorage.getItem("user") || "null");
            if (prevUser && out.user && prevUser.id !== out.user.id) {
              localStorage.removeItem("user");
            }

            setSessionId(out.sessionId);
            localStorage.setItem("sessionId", out.sessionId);

            // Profile Hydration
            let mergedUser = out.user;
            try {
              const prof = await fetchProfileWithSession(out.sessionId);
              if (prof?.user) mergedUser = { ...mergedUser, ...prof.user };
            } catch (e) {
              console.warn("Hydration failed");
            }

            setUser(mergedUser);
            localStorage.setItem("user", JSON.stringify(mergedUser));
            setIsLoading(false);
            return;
          }
        }

        // 4. LOGIC BRANCH B: Fallback to Local Session
        const localSession = localStorage.getItem("sessionId");
        const localUser = JSON.parse(localStorage.getItem("user") || "null");

        if (localSession && localUser && !isTokenExpired(localSession)) {
          try {
            const prof = await fetchProfileWithSession(localSession);
            if (prof?.user) {
              setUser({ ...localUser, ...prof.user });
              setIsLoading(false);
              return;
            }
          } catch (e) {
            clearAuth();
          }
        } else {
          clearAuth();
        }
      } catch (error) {
        console.error("Auth Error:", error);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    const clearAuth = () => {
      setSessionId(null);
      setUser(null);
      localStorage.removeItem("sessionId");
      localStorage.removeItem("user");
    };

    initAuth();
  }, []);

  const value = useMemo(
    () => ({ sessionId, user, setSessionId, isLoading }),
    [sessionId, user, isLoading],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e6e6fa]">
        <div className="text-center">
          <img
            src="/lb.png"
            alt="Logo"
            className="w-24 h-24 mx-auto animate-pulse mb-4"
          />
          <p className="text-white font-semibold">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!sessionId || !user) {
    return (
      <div className="min-h-screen bg-purple-900 flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-white text-2xl font-bold mb-4">
            Access Restricted
          </h1>
          <p className="text-white/80">
            Please open this app from within the Mark Bingo Telegram bot.
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
