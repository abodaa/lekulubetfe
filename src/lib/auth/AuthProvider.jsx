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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        console.log("🔍 Checking for initData early...", {
          hasTelegram: !!window?.Telegram,
          hasWebApp: !!window?.Telegram?.WebApp,
          initDataFromWebApp: window?.Telegram?.WebApp?.initData
            ? "PRESENT"
            : "MISSING",
          hash: window.location.hash,
          search: window.location.search,
          url: window.location.href,
        });

        const hashParamsEarly = new URLSearchParams(
          window.location.hash.substring(1),
        );
        const searchParamsEarly = new URLSearchParams(window.location.search);

        const initDataFromWebAppEarly = window?.Telegram?.WebApp?.initData;
        const initDataFromHashEarly = hashParamsEarly.get("tgWebAppData");
        const initDataFromSearchEarly = searchParamsEarly.get("tgWebAppData");

        const initDataEarly =
          (initDataFromWebAppEarly && initDataFromWebAppEarly.trim()) ||
          (initDataFromHashEarly && initDataFromHashEarly.trim()) ||
          (initDataFromSearchEarly && initDataFromSearchEarly.trim()) ||
          null;

        if (initDataEarly && initDataEarly.trim() !== "") {
          const out = await verifyTelegram(initDataEarly);
          const prevUser = (() => {
            try {
              return JSON.parse(localStorage.getItem("user"));
            } catch {
              return null;
            }
          })();
          if (prevUser && prevUser.id && prevUser.id !== out.user?.id) {
            localStorage.removeItem("user");
          }
          setSessionId(out.sessionId);
          localStorage.setItem("sessionId", out.sessionId);

          let mergedUser = out.user;
          try {
            const prof = await fetchProfileWithSession(out.sessionId);
            if (prof?.user) {
              mergedUser = {
                ...mergedUser,
                ...{
                  firstName: prof.user.firstName,
                  lastName: prof.user.lastName,
                  phone: prof.user.phone,
                  isRegistered: prof.user.isRegistered,
                },
              };
            }
          } catch {}
          setUser(mergedUser);
          localStorage.setItem("user", JSON.stringify(mergedUser));
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error(
          "Failed to refresh session with Telegram initData:",
          error,
        );
        localStorage.removeItem("sessionId");
        localStorage.removeItem("user");
        setSessionId(null);
        setUser(null);
      }

      if (sessionId && user) {
        if (isTokenExpired(sessionId)) {
          localStorage.removeItem("sessionId");
          localStorage.removeItem("user");
          setSessionId(null);
          setUser(null);
        } else {
          try {
            const prof = await fetchProfileWithSession(sessionId);
            if (prof?.user) {
              if (!user.phone || user.isRegistered === false) {
                const merged = {
                  ...user,
                  ...{
                    firstName: prof.user.firstName,
                    lastName: prof.user.lastName,
                    phone: prof.user.phone,
                    isRegistered: prof.user.isRegistered,
                  },
                };
                setUser(merged);
                localStorage.setItem("user", JSON.stringify(merged));
              }
              setIsLoading(false);
              return;
            } else {
              localStorage.removeItem("sessionId");
              localStorage.removeItem("user");
              setSessionId(null);
              setUser(null);
            }
          } catch (error) {
            localStorage.removeItem("sessionId");
            localStorage.removeItem("user");
            setSessionId(null);
            setUser(null);
          }
        }
      }

      let attempts = 0;
      const maxAttempts = 10;
      while (attempts < maxAttempts && !window?.Telegram?.WebApp) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        attempts++;
      }

      const isInTelegram =
        window?.Telegram?.WebApp &&
        (window?.Telegram?.WebApp?.initDataUnsafe?.user ||
          window?.Telegram?.WebApp?.platform === "tdesktop" ||
          window?.Telegram?.WebApp?.platform === "android" ||
          window?.Telegram?.WebApp?.platform === "ios" ||
          window?.Telegram?.WebApp?.platform === "web" ||
          navigator.userAgent.includes("Telegram"));

      if (
        isInTelegram &&
        (!window?.Telegram?.WebApp?.initData ||
          window.Telegram.WebApp.initData.trim() === "")
      ) {
        for (let i = 0; i < 10; i++) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const currentInitData = window?.Telegram?.WebApp?.initData;
          if (currentInitData && currentInitData.trim() !== "") break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);

      const initDataFromWebApp = window?.Telegram?.WebApp?.initData;
      const initDataFromHash = hashParams.get("tgWebAppData");
      const initDataFromSearch = searchParams.get("tgWebAppData");

      const initData =
        (initDataFromWebApp && initDataFromWebApp.trim()) ||
        (initDataFromHash && initDataFromHash.trim()) ||
        (initDataFromSearch && initDataFromSearch.trim()) ||
        null;

      if (!initData || initData.trim() === "") {
        const definitelyInTelegram =
          window?.Telegram?.WebApp &&
          (window?.Telegram?.WebApp?.initDataUnsafe?.user ||
            window?.Telegram?.WebApp?.platform ||
            navigator.userAgent.includes("Telegram"));

        if (definitelyInTelegram) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const finalInitData =
            (window?.Telegram?.WebApp?.initData &&
              window?.Telegram?.WebApp?.initData.trim()) ||
            new URLSearchParams(window.location.hash.substring(1))
              .get("tgWebAppData")
              ?.trim() ||
            new URLSearchParams(window.location.search)
              .get("tgWebAppData")
              ?.trim() ||
            null;

          if (finalInitData && finalInitData.trim() !== "") {
            try {
              const out = await verifyTelegram(finalInitData);
              setSessionId(out.sessionId);
              localStorage.setItem("sessionId", out.sessionId);
              let mergedUser = out.user;
              try {
                const prof = await fetchProfileWithSession(out.sessionId);
                if (prof?.user) {
                  mergedUser = {
                    ...mergedUser,
                    ...{
                      firstName: prof.user.firstName,
                      lastName: prof.user.lastName,
                      phone: prof.user.phone,
                      isRegistered: prof.user.isRegistered,
                    },
                  };
                }
              } catch {}
              setUser(mergedUser);
              localStorage.setItem("user", JSON.stringify(mergedUser));
              setIsLoading(false);
              return;
            } catch (e) {}
          }
        }

        setSessionId(null);
        setUser(null);
        localStorage.removeItem("sessionId");
        localStorage.removeItem("user");
        setIsLoading(false);
        return;
      }

      try {
        const out = await verifyTelegram(initData);
        if (out && out.sessionId) {
          setSessionId(out.sessionId);
          localStorage.setItem("sessionId", out.sessionId);
          let mergedUser = out.user;
          try {
            const prof = await fetchProfileWithSession(out.sessionId);
            if (prof?.user) {
              mergedUser = {
                ...mergedUser,
                ...{
                  firstName: prof.user.firstName,
                  lastName: prof.user.lastName,
                  phone: prof.user.phone,
                  isRegistered: prof.user.isRegistered,
                },
              };
            }
          } catch {}
          setUser(mergedUser);
          localStorage.setItem("user", JSON.stringify(mergedUser));
        } else {
          throw new Error("Invalid authentication response");
        }
      } catch (e) {
        setSessionId(null);
        setUser(null);
        localStorage.removeItem("sessionId");
        localStorage.removeItem("user");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ sessionId, user, setSessionId, isLoading }),
    [sessionId, user, isLoading],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
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
