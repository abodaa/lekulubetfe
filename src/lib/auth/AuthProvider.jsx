import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "../api/client";
import { IoReload } from "react-icons/io5";

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
      : "https://lekulubingoback.onrender.com");

  console.log("🔐 Verifying Telegram auth:", {
    apiBase,
    hasInitData: !!initData,
    initDataLength: initData?.length,
    initDataPreview: initData ? initData.substring(0, 100) : "NO_DATA",
  });

  const res = await fetch(`${apiBase}/api/auth/telegram/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });

  console.log("📡 Auth response status:", res.status, res.statusText);

  if (!res.ok) {
    const errorText = await res.text();
    console.error("❌ Auth verification failed:", {
      status: res.status,
      error: errorText,
    });
    throw new Error("verify_failed");
  }

  const result = await res.json();
  console.log("✅ Auth verification result:", {
    hasSessionId: !!result.sessionId,
    hasUser: !!result.user,
    userId: result.user?.id,
    sessionIdPreview: result.sessionId
      ? result.sessionId.substring(0, 50)
      : "NO_SESSION",
  });

  return result;
}

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
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
  // Start WITHOUT the loading screen if we already hold a valid token — returning
  // users render the app on the very first paint; the effect verifies in the
  // background. Only show the auth screen when there's no usable cached session.
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const sid = localStorage.getItem("sessionId");
      const usr = localStorage.getItem("user");
      return !(sid && usr && !isTokenExpired(sid));
    } catch {
      return true;
    }
  });

  useEffect(() => {
    let cancelled = false;

    const safeParseUser = () => {
      try {
        return JSON.parse(localStorage.getItem("user"));
      } catch {
        return null;
      }
    };

    // Read initData from the Telegram SDK or URL params (some platforms deliver
    // it via hash/search instead of WebApp.initData).
    const readInitData = () => {
      const fromWebApp = window?.Telegram?.WebApp?.initData;
      const fromHash = new URLSearchParams(
        window.location.hash.substring(1),
      ).get("tgWebAppData");
      const fromSearch = new URLSearchParams(window.location.search).get(
        "tgWebAppData",
      );
      return (
        (fromWebApp && fromWebApp.trim()) ||
        (fromHash && fromHash.trim()) ||
        (fromSearch && fromSearch.trim()) ||
        null
      );
    };

    // Bounded, fast poll for initData — only used on the slow path (no cached
    // session). Replaces the old fixed multi-second sleeps.
    const waitForInitData = async (maxMs = 1500, stepMs = 50) => {
      const start = Date.now();
      let data = readInitData();
      while (!data && Date.now() - start < maxMs) {
        await new Promise((r) => setTimeout(r, stepMs));
        data = readInitData();
      }
      return data;
    };

    const applySession = (out) => {
      if (cancelled || !out?.sessionId) return false;
      setSessionId(out.sessionId);
      localStorage.setItem("sessionId", out.sessionId);
      setUser(out.user);
      localStorage.setItem("user", JSON.stringify(out.user));
      return true;
    };

    const mergeProfile = async (sid, baseUser) => {
      try {
        const prof = await fetchProfileWithSession(sid);
        if (cancelled || !prof?.user) return;
        const merged = {
          ...baseUser,
          firstName: prof.user.firstName,
          lastName: prof.user.lastName,
          phone: prof.user.phone,
          isRegistered: prof.user.isRegistered,
          role: prof.user.role,
          language: prof.user.language || "en",
          maxCartellas: prof.user.maxCartellas || 5,
        };
        setUser(merged);
        localStorage.setItem("user", JSON.stringify(merged));
      } catch {
        /* non-fatal: keep cached user */
      }
    };

    const clearSession = () => {
      localStorage.removeItem("sessionId");
      localStorage.removeItem("user");
      setSessionId(null);
      setUser(null);
    };

    (async () => {
      const storedSid = localStorage.getItem("sessionId");
      const storedUser = safeParseUser();

      // ---- FAST PATH: valid cached token -> render immediately, verify in bg ----
      if (storedSid && storedUser && !isTokenExpired(storedSid)) {
        setIsLoading(false); // open right away

        (async () => {
          const initData = readInitData(); // no waiting on the fast path
          let sid = storedSid;
          if (initData) {
            try {
              const out = await verifyTelegram(initData);
              if (!cancelled && out?.sessionId) {
                if (
                  out.user?.id &&
                  storedUser?.id &&
                  out.user.id !== storedUser.id
                ) {
                  // Different Telegram user on this device -> switch fully.
                  applySession(out);
                  sid = out.sessionId;
                } else {
                  // Same user -> adopt the refreshed token, keep cached user.
                  sid = out.sessionId;
                  setSessionId(out.sessionId);
                  localStorage.setItem("sessionId", out.sessionId);
                }
              }
            } catch {
              /* verify failed; cached token is still used */
            }
          }
          // Refresh profile fields quietly. On failure we keep cached data
          // rather than logging the user out (avoids false gate on a blip).
          if (!cancelled && sid) {
            mergeProfile(sid, safeParseUser() || storedUser);
          }
        })();
        return;
      }

      // ---- SLOW PATH: no valid cached token -> authenticate before rendering ----
      setIsLoading(true);
      const initData = readInitData() || (await waitForInitData());
      if (cancelled) return;

      if (!initData) {
        clearSession();
        setIsLoading(false); // -> Access Restricted gate
        return;
      }

      try {
        const out = await verifyTelegram(initData);
        if (cancelled) return;
        if (!applySession(out)) {
          throw new Error("Invalid authentication response");
        }
        setIsLoading(false); // render as soon as we hold a session
        mergeProfile(out.sessionId, out.user); // background profile merge
      } catch (e) {
        if (!cancelled) {
          clearSession();
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ sessionId, user, setSessionId, isLoading }),
    [sessionId, user, isLoading],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex items-center justify-center">
        <div className="text-center">
          {/* Animated Logo */}
          <div className="relative mb-8">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center">
              <img
                src="/lb.png"
                alt="Lekulu Bingo"
                className="w-12 h-12 object-contain rounded-full animate-pulse"
              />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          </div>

          <h2 className="text-white text-lg font-bold mb-2">Authenticating</h2>
          <p className="text-white/40 text-sm mb-4">
            Please wait while we verify your account...
          </p>

          {/* Animated dots */}
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Access restricted
  if (!sessionId || !user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <span className="text-4xl">🔒</span>
          </div>

          <h1 className="text-white text-2xl font-bold mb-3">
            Access Restricted
          </h1>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">
            This application can only be accessed through Telegram. Please open
            this app from within the Telegram bot.
          </p>

          {/* Steps */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5 text-left mb-6">
            <p className="text-white/60 text-xs uppercase tracking-wider mb-3">
              How to access
            </p>
            <div className="space-y-3">
              {[
                { step: "1", text: "Open the @lekuluBingo bot in Telegram" },
                { step: "2", text: 'Click the "Play" button' },
                { step: "3", text: "The web app will open automatically" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 text-xs font-bold flex-shrink-0">
                    {step}
                  </div>
                  <p className="text-white/70 text-sm">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 transition-all"
          >
            <IoReload /> Try Again
          </button>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
