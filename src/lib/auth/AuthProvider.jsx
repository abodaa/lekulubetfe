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
    const error = await res.text();
    throw new Error(error || "verify_failed");
  }

  return res.json();
}

async function fetchProfileWithSession(sessionId) {
  if (!sessionId) return null;
  try {
    return await apiFetch("/user/profile", { sessionId });
  } catch {
    return null;
  }
}

// Optional: Development mock (remove or condition in production)
const isDev = import.meta.env.DEV;
if (isDev && !window.Telegram?.WebApp) {
  console.warn("🔧 Dev mode: Mocking Telegram WebApp");
  window.Telegram = {
    WebApp: {
      initData: "", // Paste a real initData string here for local testing if needed
      platform: "android",
      ready: () => {},
    },
  };
}

export function AuthProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        console.log("🚀 Auth init started");

        const tg = window?.Telegram?.WebApp;
        const initData = tg?.initData?.trim() || "";

        // 1. Try stored valid session first (survives refresh)
        const storedSession = localStorage.getItem("sessionId");
        if (storedSession) {
          const prof = await fetchProfileWithSession(storedSession);
          if (prof?.user) {
            setSessionId(storedSession);
            setUser(prof.user);
            setIsLoading(false);
            return;
          }
          // Invalid session → clear it
          localStorage.removeItem("sessionId");
          localStorage.removeItem("user");
        }

        // 2. Try Telegram initData (primary auth method)
        if (initData.length > 20) {
          // reasonable minimum length
          const out = await verifyTelegram(initData);
          setSessionId(out.sessionId);
          setUser(out.user);

          localStorage.setItem("sessionId", out.sessionId);
          localStorage.setItem("user", JSON.stringify(out.user));

          setIsLoading(false);
          return;
        }

        // 3. No valid auth found
        console.warn("No Telegram initData or valid session");
      } catch (e) {
        console.error("Auth error:", e);
      } finally {
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
    webApp: !!window?.Telegram?.WebApp,
    initData: window?.Telegram?.WebApp?.initData ? "PRESENT" : "NONE",
    initDataLength: window?.Telegram?.WebApp?.initData?.length || 0,
    platform: window?.Telegram?.WebApp?.platform || "UNKNOWN",
    userAgent: navigator.userAgent,
    hasSession: !!sessionId,
    hasUser: !!user,
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p>Authenticating with Telegram...</p>
          <pre
            style={{
              marginTop: "20px",
              fontSize: "10px",
              color: "#666",
              textAlign: "left",
            }}
          >
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (!sessionId || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <h1 className="text-xl font-bold mb-4">⚠️ Access Restricted</h1>
          <p className="mb-4">
            You must open this app from inside Telegram.
            <br />
            Please go back to the bot and tap the <strong>
              🎮 Play-10
            </strong>{" "}
            button.
          </p>
          <p className="text-sm text-gray-500">
            Do not open this link directly in your browser or refresh the page
            outside Telegram.
          </p>

          <pre
            style={{
              marginTop: "30px",
              fontSize: "10px",
              color: "#999",
              textAlign: "left",
              maxWidth: "320px",
              margin: "30px auto 0",
            }}
          >
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
