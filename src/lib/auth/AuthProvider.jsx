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

  if (!res.ok) throw new Error("verify_failed");

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

export function AuthProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        console.log("🚀 Auth init started");

        // 🔐 1. Check stored session
        const storedSession = localStorage.getItem("sessionId");
        const storedUser = localStorage.getItem("user");

        if (storedSession && storedUser) {
          try {
            const prof = await fetchProfileWithSession(storedSession);
            if (prof?.user) {
              setSessionId(storedSession);
              setUser(JSON.parse(storedUser));
              setIsLoading(false);
              return;
            }
          } catch {}

          localStorage.removeItem("sessionId");
          localStorage.removeItem("user");
        }

        // 🔄 2. Telegram login (if available)
        const tg = window?.Telegram?.WebApp;
        const initData = tg?.initData;

        if (initData && initData.trim() !== "") {
          const out = await verifyTelegram(initData);

          setSessionId(out.sessionId);
          localStorage.setItem("sessionId", out.sessionId);

          setUser(out.user);
          localStorage.setItem("user", JSON.stringify(out.user));

          setIsLoading(false);
          return;
        }

        // ❌ No auth
        setSessionId(null);
        setUser(null);
      } catch (e) {
        console.error("Auth error:", e);
        setSessionId(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ sessionId, user, setSessionId, isLoading }),
    [sessionId, user, isLoading],
  );

  // 🔍 DEBUG INFO (VISIBLE IN UI)
  const debugInfo = {
    telegram: !!window?.Telegram,
    webApp: !!window?.Telegram?.WebApp,
    initData: window?.Telegram?.WebApp?.initData || "NONE",
    initDataLength: window?.Telegram?.WebApp?.initData?.length || 0,
    platform: window?.Telegram?.WebApp?.platform || "UNKNOWN",
    userAgent: navigator.userAgent,
    hasSession: !!sessionId,
    hasUser: !!user,
  };

  // ⏳ Loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p>Authenticating...</p>

          <pre
            style={{
              marginTop: "20px",
              fontSize: "10px",
              color: "black",
              textAlign: "left",
              maxWidth: "300px",
              overflow: "auto",
            }}
          >
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // 🔒 Block
  if (!sessionId || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <h1 className="text-xl font-bold mb-4">⚠️ Access Restricted</h1>
          <p>
            You must be logged in to access this app.
            <br />
            Please open from Telegram or login.
          </p>

          {/* 🔍 DEBUG PANEL */}
          <pre
            style={{
              marginTop: "20px",
              fontSize: "10px",
              color: "white",
              textAlign: "left",
              maxWidth: "300px",
              overflow: "auto",
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
