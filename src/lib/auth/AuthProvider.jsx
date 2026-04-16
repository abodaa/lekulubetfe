import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";

import { apiFetch } from "../api/client";

const AuthContext = createContext({
  sessionId: null,
  user: null,
  setSessionId: () => {},
});

async function verifyTelegram(initData) {
  const apiBase = "http://localhost:3001";

  console.log("🔐 Verifying Telegram auth:", {
    apiBase,
    hasInitData: !!initData,
    initDataLength: initData?.length,
  });

  const res = await fetch(`${apiBase}/api/auth/telegram/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  console.log("📡 Auth response:", res.status);

  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ Auth failed:", errorText);
    throw new Error("verify_failed");
  }

  return res.json();
}

/**
 * Safe JWT check (won't crash if not JWT)
 */
function isTokenExpired(token) {
  if (!token) return true;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false; // not JWT → treat as sessionId

    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);

    return payload.exp < now;
  } catch {
    return false;
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
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  const didRun = useRef(false); // ✅ prevents double execution

  /**
   * Unified initData resolver (FIXED)
   */
  const getInitData = () => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const searchParams = new URLSearchParams(window.location.search);

    const tg = window?.Telegram?.WebApp?.initData;

    return (
      (tg && tg.trim()) ||
      hashParams.get("tgWebAppData")?.trim() ||
      searchParams.get("tgWebAppData")?.trim() ||
      null
    );
  };

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    (async () => {
      try {
        console.log("🚀 Auth init started");

        const initData = getInitData();

        /**
         * 1. TELEGRAM AUTH (HIGHEST PRIORITY)
         */
        if (initData) {
          console.log("🔵 Telegram initData found → authenticating");

          const out = await verifyTelegram(initData);

          setSessionId(out.sessionId);
          localStorage.setItem("sessionId", out.sessionId);

          let mergedUser = out.user;

          try {
            const prof = await fetchProfileWithSession(out.sessionId);
            if (prof?.user) {
              mergedUser = {
                ...mergedUser,
                firstName: prof.user.firstName,
                lastName: prof.user.lastName,
                phone: prof.user.phone,
                isRegistered: prof.user.isRegistered,
              };
            }
          } catch {
            console.warn("⚠️ Failed to fetch profile with new session");
          }

          setUser(mergedUser);
          localStorage.setItem("user", JSON.stringify(mergedUser));

          setIsLoading(false);
          return; // 🔥 STOP HERE
        }

        /**
         * 2. SESSION RESTORE
         */
        if (sessionId && user) {
          console.log("🟡 Restoring session...");

          if (isTokenExpired(sessionId)) {
            console.log("❌ Session expired");

            localStorage.removeItem("sessionId");
            localStorage.removeItem("user");

            setSessionId(null);
            setUser(null);
          } else {
            const prof = await fetchProfileWithSession(sessionId);

            if (prof?.user) {
              setUser((prev) => ({
                ...prev,
                ...prof.user,
              }));

              setIsLoading(false);
              return;
            }
          }
        }

        /**
         * 3. FINAL FALLBACK (NO BYPASS, NO GUEST)
         */
        console.warn("⚠️ No valid Telegram session found");

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
  }, []); // ✅ IMPORTANT: keep empty dependency

  const value = useMemo(
    () => ({ sessionId, user, setSessionId, isLoading }),
    [sessionId, user, isLoading],
  );

  console.log("AuthProvider render:", {
    sessionId: !!sessionId,
    user: !!user,
    isLoading,
  });

  /**
   * LOADING UI
   */
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p>Authenticating...</p>
        </div>
      </div>
    );
  }

  /**
   * BLOCK UI
   */
  if (!sessionId || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <h1 className="text-xl font-bold mb-4">Access Restricted</h1>

          <p>This app must be opened from Telegram.</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
