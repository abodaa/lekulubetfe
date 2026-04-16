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

const isDev = import.meta.env.DEV;
const allowDevAuth = isDev && import.meta.env.VITE_ALLOW_DEV_AUTH === "true";

/**
 * Telegram verify API
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

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

/**
 * Fetch profile via session
 */
async function fetchProfileWithSession(sessionId) {
  if (!sessionId) return null;
  try {
    return await apiFetch("/user/profile", { sessionId });
  } catch {
    return null;
  }
}

/**
 * Mock Telegram for local dev
 */
if (isDev && !window.Telegram?.WebApp) {
  console.warn("🔧 Mock Telegram WebApp enabled");

  window.Telegram = {
    WebApp: {
      initData: "",
      platform: "web",
      version: "dev",
      ready: () => {},
    },
  };
}

export function AuthProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const tg = window?.Telegram?.WebApp;
  const initData = tg?.initData?.trim() || "";
  const isTelegramUser = initData.length > 20;

  /**
   * AUTH FLOW
   */
  useEffect(() => {
    (async () => {
      try {
        console.log("🚀 Auth starting...");

        /**
         * 1. Restore session first
         */
        const storedSession = localStorage.getItem("sessionId");

        if (storedSession) {
          const prof = await fetchProfileWithSession(storedSession);

          if (prof?.user) {
            setSessionId(storedSession);
            setUser(prof.user);
            setIsLoading(false);
            return;
          }

          localStorage.removeItem("sessionId");
          localStorage.removeItem("user");
        }

        /**
         * 2. Telegram login (REAL USER)
         */
        if (isTelegramUser) {
          const out = await verifyTelegram(initData);

          setSessionId(out.sessionId);
          setUser(out.user);

          localStorage.setItem("sessionId", out.sessionId);
          localStorage.setItem("user", JSON.stringify(out.user));

          setIsLoading(false);
          return;
        }

        /**
         * 3. DEV MODE (optional bypass)
         */
        if (allowDevAuth) {
          console.warn("🔧 DEV AUTH ENABLED");

          const mockUser = {
            id: "dev-user",
            username: "developer",
            first_name: "Dev",
          };

          const mockSession = "dev-session";

          setSessionId(mockSession);
          setUser(mockUser);

          localStorage.setItem("sessionId", mockSession);
          localStorage.setItem("user", JSON.stringify(mockUser));

          setIsLoading(false);
          return;
        }

        /**
         * 4. GUEST MODE (IMPORTANT CHANGE)
         * Allow browser access safely
         */
        console.warn("👤 Guest mode activated");

        const guestUser = {
          id: "guest",
          username: "guest",
          first_name: "Guest",
          isGuest: true,
        };

        const guestSession = "guest-session";

        setSessionId(guestSession);
        setUser(guestUser);

        setIsLoading(false);
      } catch (err) {
        console.error("Auth error:", err);
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ sessionId, user, setSessionId, isLoading }),
    [sessionId, user, isLoading],
  );

  const debugInfo = {
    telegram: !!window?.Telegram,
    isTelegramUser,
    initDataLength: initData.length,
    hasSession: !!sessionId,
    isGuest: user?.isGuest,
    devMode: allowDevAuth,
  };

  /**
   * LOADING UI
   */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p>Loading...</p>
          <pre style={{ fontSize: "10px", marginTop: 20 }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
