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
        // 🔐 1. Check existing session
        const storedSession = localStorage.getItem("sessionId");
        const storedUser = localStorage.getItem("user");

        if (storedSession && storedUser) {
          try {
            const prof = await fetchProfileWithSession(storedSession);
            if (prof?.user) {
              console.log("✅ Existing session valid");

              setSessionId(storedSession);
              setUser(JSON.parse(storedUser));
              setIsLoading(false);
              return;
            } else {
              console.warn("⚠️ Session invalid, clearing...");
            }
          } catch {
            console.warn("⚠️ Session check failed, clearing...");
          }

          localStorage.removeItem("sessionId");
          localStorage.removeItem("user");
        }

        // 🔄 2. Try Telegram login (optional)
        const tg = window?.Telegram?.WebApp;
        const initData = tg?.initData;

        if (initData && initData.trim() !== "") {
          console.log("🔐 Logging in via Telegram...");

          const out = await verifyTelegram(initData);

          setSessionId(out.sessionId);
          localStorage.setItem("sessionId", out.sessionId);

          setUser(out.user);
          localStorage.setItem("user", JSON.stringify(out.user));

          setIsLoading(false);
          return;
        }

        // ❌ 3. No authentication
        console.warn("❌ No valid authentication found");

        setSessionId(null);
        setUser(null);
      } catch (e) {
        console.error("❌ Auth error:", e);
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

  // ⏳ Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Authenticating...</p>
      </div>
    );
  }

  // 🔒 Block unauthenticated users
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
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
