import React, { useState, useEffect, useRef, useMemo } from "react";
import CartellaCard from "../components/CartellaCard";
import { apiFetch } from "../lib/api/client";
import { useAuth } from "../lib/auth/AuthProvider";
import { useToast } from "../contexts/ToastContext";
import { useWebSocket } from "../contexts/WebSocketContext";
import { getCachedCartellas, prefetchCartellas } from "../lib/cartellaCache";
import { useT } from "../contexts/Languagecontext";

export default function CartelaSelection({
  onNavigate,
  onResetToGame,
  stake,
  onCartelaSelected,
  onGameIdUpdate,
}) {
  const { sessionId, user } = useAuth();
  const { showError, showSuccess, showWarning } = useToast();
  const t = useT();
  // Per-user cartella limit (admin-configurable); falls back to 5.
  const maxCartellas =
    Number(user?.maxCartellas) > 0 ? Number(user.maxCartellas) : 5;
  const [cards, setCards] = useState(() => getCachedCartellas() || []);
  const [loading, setLoading] = useState(() => !getCachedCartellas());
  const [error, setError] = useState(null);
  const [walletLoading, setWalletLoading] = useState(() => {
    try {
      return !localStorage.getItem("lekulu_wallet");
    } catch {
      return true;
    }
  });
  const [alertBanners, setAlertBanners] = useState([]);
  const alertTimersRef = useRef(new Map());
  const isSelectingRef = useRef(false);
  const [wallet, setWallet] = useState(() => {
    try {
      const cached = localStorage.getItem("lekulu_wallet");
      if (cached) return JSON.parse(cached);
    } catch {
      /* ignore */
    }
    return { main: 0, bonus: 0 };
  });
  const [refreshing, setRefreshing] = useState(false);

  const {
    connected,
    gameState,
    selectCartella,
    deselectCartella,
    connectToStake,
    wsReadyState,
    isConnecting,
    lastEvent,
    group,
  } = useWebSocket();

  const hasConnectedRef = useRef(false);
  const rejoinTriedRef = useRef(false);
  const roomCheckTimerRef = useRef(null);
  const isNavigatingBackRef = useRef(false);

  const totalCartellas = gameState.totalCartellas || cards.length || 200;

  // Connect to stake when component mounts
  useEffect(() => {
    if (stake && sessionId && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connectToStake(stake);
    }
  }, [stake, sessionId, connectToStake]);

  // Reset connection ref when stake changes
  useEffect(() => {
    hasConnectedRef.current = false;
    rejoinTriedRef.current = false;
  }, [stake]);

  // Reconnect if waiting too long
  useEffect(() => {
    if (!stake || !connected) return;
    if (roomCheckTimerRef.current) clearTimeout(roomCheckTimerRef.current);
    if (gameState.phase === "waiting" && !gameState.gameId) {
      roomCheckTimerRef.current = setTimeout(() => {
        rejoinTriedRef.current = false;
        connectToStake(stake);
      }, 2000);
    }
    return () => {
      if (roomCheckTimerRef.current) clearTimeout(roomCheckTimerRef.current);
    };
  }, [stake, connected, gameState.phase, gameState.gameId, connectToStake]);

  useEffect(() => {
    return () => {
      if (roomCheckTimerRef.current) clearTimeout(roomCheckTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (gameState.phase === "registration") setError(null);
  }, [gameState.phase]);

  useEffect(() => {
    if (gameState.phase === "announce" || gameState.winners?.length > 0) {
      setError(null);
      if (stake && sessionId) connectToStake(stake);
    }
  }, [gameState.phase, gameState.winners, stake, sessionId, connectToStake]);

  useEffect(() => {
    if (!stake || !sessionId) return;
    if (!connected || isConnecting) return;
    if (rejoinTriedRef.current) return;
    if (gameState.phase !== "registration") {
      rejoinTriedRef.current = true;
      connectToStake(stake);
    }
  }, [
    stake,
    sessionId,
    connected,
    isConnecting,
    gameState.phase,
    connectToStake,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && stake && sessionId) {
        setTimeout(() => {
          if (!connected) connectToStake(stake);
        }, 100);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [stake, sessionId, connected, connectToStake]);

  useEffect(() => {
    if (gameState.gameId) onGameIdUpdate?.(gameState.gameId);
  }, [gameState.gameId, onGameIdUpdate]);

  // Fetch wallet balance
  useEffect(() => {
    // Fetch wallet function
    const fetchWallet = async () => {
      if (!sessionId) return;
      let hadCache = false;
      try {
        hadCache = !!localStorage.getItem("lekulu_wallet");
      } catch {
        /* ignore */
      }
      try {
        // Only show the blocking loader on a true cold start; otherwise refresh
        // silently behind the already-displayed cached balance.
        if (!hadCache) setWalletLoading(true);
        const walletResponse = await apiFetch("/wallet", { sessionId });

        const mainValue = walletResponse.main ?? walletResponse.balance ?? 0;
        const bonusValue = walletResponse.bonus ?? 0;

        const next = { main: mainValue, bonus: bonusValue };
        setWallet(next);
        try {
          localStorage.setItem("lekulu_wallet", JSON.stringify(next));
        } catch {
          /* ignore */
        }
      } catch (walletErr) {
        console.error("Wallet fetch error:", walletErr);
        // Fallback to profile
        try {
          const profileResponse = await apiFetch("/user/profile", {
            sessionId,
          });
          if (profileResponse.wallet) {
            const next = {
              main:
                profileResponse.wallet.main ??
                profileResponse.wallet.balance ??
                0,
              bonus: profileResponse.wallet.bonus ?? 0,
            };
            setWallet(next);
            try {
              localStorage.setItem("lekulu_wallet", JSON.stringify(next));
            } catch {
              /* ignore */
            }
          }
        } catch (profileErr) {
          console.error("Profile fetch error:", profileErr);
          if (!hadCache) setWallet({ main: 0, bonus: 0 });
        }
      } finally {
        setWalletLoading(false);
      }
    };
    fetchWallet();
  }, [sessionId]);

  // WebSocket wallet update listener
  useEffect(() => {
    if (!gameState?.walletUpdate) return;
    const update = gameState.walletUpdate;
    setWallet((prev) => {
      const next = {
        main: update.main ?? prev.main ?? 0,
        bonus: update.bonus ?? prev.bonus ?? 0,
      };
      try {
        localStorage.setItem("lekulu_wallet", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [gameState.walletUpdate]);

  const [retryCount, setRetryCount] = useState(0);

  // Cartella layouts are static — serve from cache instantly; fetch once if cold.
  useEffect(() => {
    if (!sessionId) return;

    const cached = getCachedCartellas();
    if (cached) {
      setCards(cached);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);
    prefetchCartellas(sessionId).then((fetched) => {
      if (!alive) return;
      if (fetched && fetched.length > 0) {
        setCards(fetched);
        setError(null);
      } else {
        setError("Failed to load cards from server");
      }
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [sessionId, retryCount]);

  // Auto-navigate to game layout when game starts
  useEffect(() => {
    const selectedNumbers = Array.isArray(gameState.yourSelections)
      ? gameState.yourSelections
      : [];
    const hasCards =
      Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0;
    const isGameRunning = gameState.phase === "running" && gameState.gameId;
    const isGameStarting = gameState.phase === "starting" && gameState.gameId;
    const hasPlayers =
      typeof gameState.playersCount === "number" && gameState.playersCount >= 2;
    const shouldGoToGameLayout =
      (isGameRunning || isGameStarting) && hasPlayers;

    if (shouldGoToGameLayout) {
      onGameIdUpdate?.(gameState.gameId);
      let cardNumbersToPass = [];
      if (hasCards && Array.isArray(gameState.yourCards)) {
        cardNumbersToPass = gameState.yourCards
          .map((card) => card.cardNumber || card)
          .filter((num) => num != null);
      } else if (selectedNumbers.length > 0) {
        cardNumbersToPass = selectedNumbers;
      }
      onCartelaSelected?.(cardNumbersToPass);
      onNavigate?.("game-layout", true);
    }
  }, [
    gameState.phase,
    gameState.gameId,
    gameState.yourSelections,
    gameState.yourCards,
    onGameIdUpdate,
    onCartelaSelected,
    onNavigate,
  ]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "game_cancelled")
      showWarning(t("cs.not_enough_player"));
    if (
      lastEvent.type === "selection_rejected" &&
      lastEvent.payload?.reason === "LIMIT_REACHED"
    )
      showError(
        t("cs.max5", { max: lastEvent.payload?.limit || maxCartellas }),
      );
    if (
      lastEvent.type === "selection_rejected" &&
      lastEvent.payload?.reason === "INSUFFICIENT_FUNDS"
    )
      showError(
        t("cs.insufficient_need", { needed: lastEvent.payload?.needed }),
      );
  }, [lastEvent, showError, showWarning]);

  useEffect(() => {
    const hasSelection =
      Array.isArray(gameState?.yourSelections) &&
      gameState.yourSelections.length > 0;
    const countdownZero =
      typeof gameState?.countdown === "number" && gameState.countdown <= 0;
    // While the phase is still "registration", a 0 countdown means the server
    // is holding/extending registration to wait for more players — registration
    // has NOT ended. Show a waiting message (not an "ended" one), and only after
    // a short grace period so a momentary 0 right before the server extends the
    // timer doesn't flash the banner.
    const waitingForPlayers =
      gameState?.phase === "registration" && countdownZero && !hasSelection;
    const msg = t("cs.waiting_more");

    if (waitingForPlayers) {
      const timer = setTimeout(() => {
        setAlertBanners((prev) => (prev.includes(msg) ? prev : [...prev, msg]));
      }, 4000);
      return () => clearTimeout(timer);
    }
    setAlertBanners((prev) =>
      prev.includes(msg) ? prev.filter((m) => m !== msg) : prev,
    );
  }, [gameState?.phase, gameState?.countdown, gameState?.yourSelections]);

  useEffect(() => {
    const currentMessages = new Set(alertBanners);
    alertTimersRef.current.forEach((timer, msg) => {
      if (!currentMessages.has(msg)) {
        clearTimeout(timer);
        alertTimersRef.current.delete(msg);
      }
    });
    alertBanners.forEach((alertMsg) => {
      if (!alertTimersRef.current.has(alertMsg)) {
        const timer = setTimeout(() => {
          setAlertBanners((prev) => prev.filter((msg) => msg !== alertMsg));
          alertTimersRef.current.delete(alertMsg);
        }, 3000);
        alertTimersRef.current.set(alertMsg, timer);
      }
    });
  }, [alertBanners]);

  useEffect(() => {
    return () => {
      alertTimersRef.current.forEach((timer) => clearTimeout(timer));
      alertTimersRef.current.clear();
    };
  }, []);

  // ===== Optimistic selection =====
  // Reflect a tap instantly, then reconcile with the server's confirmation and
  // revert if it gets rejected — so selecting a card feels immediate.
  const [pending, setPending] = useState({}); // { [cardNum]: "add" | "remove" }

  const effectiveSelections = useMemo(() => {
    const s = new Set(
      (Array.isArray(gameState.yourSelections)
        ? gameState.yourSelections
        : []
      ).map(Number),
    );
    for (const [num, op] of Object.entries(pending)) {
      if (op === "add") s.add(Number(num));
      else s.delete(Number(num));
    }
    return Array.from(s);
  }, [gameState.yourSelections, pending]);

  // Clear pending entries once the server's state catches up to them.
  useEffect(() => {
    const server = new Set(
      (Array.isArray(gameState.yourSelections)
        ? gameState.yourSelections
        : []
      ).map(Number),
    );
    setPending((prev) => {
      let changed = false;
      const next = {};
      for (const [num, op] of Object.entries(prev)) {
        const inServer = server.has(Number(num));
        if ((op === "add" && inServer) || (op === "remove" && !inServer)) {
          changed = true; // server caught up — drop this pending entry
        } else {
          next[num] = op;
        }
      }
      return changed ? next : prev;
    });
  }, [gameState.yourSelections]);

  // If the server rejects a selection, drop optimistic state and resync.
  useEffect(() => {
    if (lastEvent?.type === "selection_rejected") {
      setPending({});
    }
  }, [lastEvent]);

  // ========== MAIN HANDLER FOR SELECTING A CARTELLA ==========
  const handleCardSelect = async (cardNumber) => {
    // Prevent multiple rapid clicks
    if (isSelectingRef.current) {
      return;
    }

    isSelectingRef.current = true;

    try {
      const cardNum = Number(cardNumber);

      if (walletLoading) {
        showError(t("cs.loading_wallet"));
        return;
      }

      // Validate against the optimistic set so rapid taps respect the 5 limit.
      const selectedNumbers = effectiveSelections;

      // Check if game is in registration phase
      if (gameState.phase !== "registration") {
        const waitMsg = t("cs.wait_finish");
        setAlertBanners((prev) =>
          prev.includes(waitMsg) ? prev : [...prev, waitMsg],
        );
        showError(waitMsg);
        return;
      }

      // Check WebSocket connection
      if (!connected || wsReadyState !== WebSocket.OPEN) {
        // Self-heal: kick off a reconnect so the next tap goes through.
        if (stake) connectToStake(stake);
        showError(t("cs.reconnecting"));
        return;
      }

      // Check if already selected this card
      if (selectedNumbers.includes(cardNum)) {
        showError(t("cs.already_selected", { n: cardNum }));
        return;
      }
      // Check max cartellas (5)
      if (selectedNumbers.length >= maxCartellas) {
        showError(t("cs.max5_reached", { max: maxCartellas }));
        return;
      }

      // Check if card is taken by other players
      const isTakenByOthers = gameState.takenCards.some(
        (taken) => Number(taken) === cardNum,
      );
      if (isTakenByOthers) {
        setAlertBanners((prev) =>
          prev.includes("This cartella is already taken")
            ? prev
            : [...prev, "This cartella is already taken."],
        );
        showError(t("cs.taken"));
        return;
      }

      // Check if user has enough balance for ALL cartellas (current + new)
      const totalBalance =
        (Number(wallet.main) || 0) + (Number(wallet.bonus) || 0);
      const newTotalCount = selectedNumbers.length + 1;
      const totalNeeded = newTotalCount * Number(stake);

      console.log("=== Balance Check Debug ===");
      console.log("Main wallet:", wallet.main);
      console.log("Bonus wallet:", wallet.bonus);
      console.log("Selected cartellas count:", selectedNumbers.length);
      console.log("Stake:", stake);
      console.log("Total needed:", (selectedNumbers.length + 1) * stake);
      console.log(
        "Available (Main + Bonus):",
        (wallet.main || 0) + (wallet.bonus || 0),
      );

      if (totalBalance < totalNeeded) {
        const msg = t("cs.insufficient_detail", {
          needed: totalNeeded,
          count: newTotalCount,
          have: totalBalance.toLocaleString(),
        });
        setAlertBanners((prev) => [...prev, msg]);
        showError(msg);
        return;
      }

      // Select the cartella — optimistically reflect it immediately.
      selectCartella(cardNum);
      setPending((p) => ({ ...p, [cardNum]: "add" }));
    } catch (err) {
      console.error("Error selecting cartella:", err);
      showError(t("cs.fail_select"));
    } finally {
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 150);
    }
  };

  // ========== HANDLER FOR REMOVING A CARTELLA ==========
  const handleRemoveCartella = async (cardNumber) => {
    const cardNum = Number(cardNumber);
    const selectedNumbers = effectiveSelections;

    if (!selectedNumbers.includes(cardNum)) {
      showError(t("cs.not_selected", { n: cardNum }));
      return;
    }

    if (gameState.phase !== "registration") {
      showError(t("cs.cannot_remove"));
      return;
    }

    try {
      deselectCartella(cardNum);
      setPending((p) => ({ ...p, [cardNum]: "remove" }));
    } catch (err) {
      console.error("Error removing cartella:", err);

      showError(t("cs.fail_remove"));
    }
  };

  const timerSeconds =
    gameState.phase === "registration"
      ? gameState.countdown > 0
        ? gameState.countdown
        : "···"
      : gameState.phase === "waiting"
        ? "--"
        : gameState.countdown || 0;

  const selectedNumbers = effectiveSelections;

  const totalBalance = (Number(wallet.main) || 0) + (Number(wallet.bonus) || 0);
  const cardsReady = Array.isArray(cards) && cards.length > 0;

  // Derash (prize pool) = 80% of all staked cartellas. Prefer the server value
  // when present, otherwise derive it from the number of taken cartellas.
  const derashAmount =
    gameState?.prizePool && gameState.prizePool > 0
      ? gameState.prizePool
      : Math.floor((gameState?.takenCards?.length || 0) * (stake || 0) * 0.8);

  // Manual refresh: re-request a fresh room snapshot and re-pull the wallet.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (stake) connectToStake(stake);
      if (sessionId) {
        const w = await apiFetch("/wallet", { sessionId });
        const next = {
          main: w.main ?? w.balance ?? 0,
          bonus: w.bonus ?? 0,
        };
        setWallet(next);
        try {
          localStorage.setItem("lekulu_wallet", JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      showError(t("cs.fail_refresh"));
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  // Loading state — only block while actively loading with nothing to show yet.
  if (loading && !cardsReady) {
    return (
      <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 text-lg font-medium">
            Loading cartellas...
          </p>
          <p className="text-white/40 text-sm mt-1">Stake: {stake} ETB</p>
        </div>
      </div>
    );
  }

  // Error / empty state — failed or empty fetch (no more infinite spinner).
  if (error || !cardsReady) {
    return (
      <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-bold mb-2">
            {t("cs.conn_error")}
          </h2>
          <p className="text-white/60 mb-6">{error || t("cs.load_fail")}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/20 transition-all"
          >
            🔄 {t("common.retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex flex-col">
      {/* Alert Banners */}
      {alertBanners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
          {alertBanners.map((msg, i) => (
            <div
              key={i}
              className="bg-gray-900/90 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white text-sm flex items-center gap-3 shadow-lg animate-slide-down"
            >
              <span className="text-lg">⚠️</span>
              <span className="flex-1">{msg}</span>
              <button
                onClick={() =>
                  setAlertBanners((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-gray-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md mx-auto w-full flex flex-col flex-1">
        {/* Group banner */}
        {group?.code && (
          <div className="mx-4 mt-3 -mb-1 flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2">
            <span className="flex items-center gap-2 text-amber-200 text-xs font-semibold">
              <span className="opacity-70">{t("common.group")}</span>
              <span className="tracking-[0.2em] font-extrabold text-amber-300">
                {group.code}
              </span>
            </span>
            <span className="text-amber-100/80 text-xs font-semibold">
              {(group.members || []).filter((m) => m.online).length}/
              {group.memberCount || (group.members || []).length}{" "}
              {t("gh.player_many")}
            </span>
          </div>
        )}
        {/* Header */}
        <header className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            {/* Back + Refresh */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Prevent double clicks
                  if (isNavigatingBackRef.current) return;
                  isNavigatingBackRef.current = true;

                  // Clear alert banners
                  setAlertBanners([]);
                  alertTimersRef.current.forEach((timer) =>
                    clearTimeout(timer),
                  );
                  alertTimersRef.current.clear();

                  // If user has selected cartellas, deselect them all
                  const selectedNumbers = Array.isArray(
                    gameState.yourSelections,
                  )
                    ? gameState.yourSelections
                    : [];

                  if (selectedNumbers.length > 0) {
                    console.log(
                      `🗑️ Deselecting ${selectedNumbers.length} cartellas before leaving...`,
                    );
                    // Deselect all cartellas
                    for (const cardNum of selectedNumbers) {
                      deselectCartella(cardNum);
                    }
                  }

                  // Reset stake directly — instant, no navigation overlay.
                  onResetToGame?.();

                  // Reset flag after delay
                  setTimeout(() => {
                    isNavigatingBackRef.current = false;
                  }, 500);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white/70 text-sm font-medium hover:bg-white/20 hover:text-white transition-all"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                {t("common.back")}
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label={t("gh.refresh")}
                title={t("gh.refresh")}
                className="flex items-center justify-center h-[38px] w-[38px] rounded-xl bg-white/10 border border-white/20 text-white/70 hover:bg-white/20 hover:text-white transition-all disabled:opacity-60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </div>

            {/* Timer */}
            <div
              className={`px-4 py-2 rounded-xl text-center min-w-[80px] transition-all ${
                gameState.phase === "registration"
                  ? "bg-gradient-to-b from-amber-400/25 to-amber-500/5 border border-amber-400/50 shadow-[0_0_22px_rgba(245,158,11,0.25)]"
                  : "bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10"
              }`}
            >
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                {t("cs.timer")}
              </div>
              <div
                className={`text-2xl font-extrabold font-mono ${
                  gameState.phase === "registration"
                    ? "text-amber-300"
                    : "text-white/60"
                }`}
              >
                {timerSeconds}
              </div>
            </div>

            {/* Derash (prize pool) */}
            <div className="px-4 py-2 rounded-xl text-center min-w-[80px] bg-gradient-to-b from-amber-400/20 to-amber-500/5 border border-amber-400/40">
              <div className="text-amber-200/60 text-[10px] uppercase tracking-wider">
                {t("common.derash")}
              </div>
              <div className="text-2xl font-extrabold text-amber-300 leading-tight">
                {derashAmount}
              </div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-4 gap-2">
            {/* <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-xl p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Main
              </div>
              <div className="text-white font-bold text-sm">
                {walletLoading ? "..." : (wallet.main || 0).toLocaleString()}
              </div>
            </div> */}
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-xl p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                {t("cs.main")}
              </div>
              <div className="text-white font-bold text-sm">
                {walletLoading
                  ? "..."
                  : (Number(wallet.main) || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-xl p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-white/40 text-xs uppercase tracking-wider">
                {t("cs.bonus")}
              </div>
              <div className="text-white font-bold text-sm">
                {walletLoading
                  ? "..."
                  : (Number(wallet.bonus) || 0).toLocaleString()}
              </div>
            </div>
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-xl p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                {t("gh.stake")}
              </div>
              <div className="text-white font-bold text-sm">{stake}</div>
            </div>
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 rounded-xl p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                {t("cs.players_label")}
              </div>
              <div className="text-white font-bold text-sm">
                {gameState.takenCards?.length || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Card Selection Grid */}
        <main className="flex-1 px-4 pb-4 overflow-y-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white/80 text-sm font-semibold">
                {t("cs.select_your")}
              </h3>
              <span className="text-white/40 text-xs">
                {t("cs.cards_count", { n: totalCartellas })}
              </span>
            </div>
            <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.01] backdrop-blur-xl rounded-2xl p-2 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] max-h-[420px] overflow-y-auto">
              <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: totalCartellas }, (_, i) => i + 1).map(
                  (cartelaNumber) => {
                    const cartelaNum = Number(cartelaNumber);
                    const hasCards =
                      Array.isArray(gameState.yourCards) &&
                      gameState.yourCards.length > 0;
                    const shouldShowTakenCards =
                      gameState.phase === "registration" || hasCards;
                    const isTaken = shouldShowTakenCards
                      ? gameState.takenCards.some(
                          (taken) => Number(taken) === cartelaNum,
                        )
                      : false;
                    const isSelected = selectedNumbers.includes(cartelaNum);

                    return (
                      <button
                        key={cartelaNumber}
                        onClick={() => handleCardSelect(cartelaNum)}
                        disabled={gameState.phase !== "registration"}
                        className={`aspect-square rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center ${
                          isSelected
                            ? "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 border border-amber-200/70 scale-105 shadow-[0_4px_16px_rgba(245,158,11,0.45)] ring-1 ring-amber-300/50"
                            : isTaken
                              ? "bg-red-400 text-white border border-red-400 cursor-not-allowed"
                              : gameState.phase === "registration"
                                ? "bg-gradient-to-b from-white/[0.1] to-white/[0.02] text-white/80 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:from-amber-400/25 hover:to-amber-400/5 hover:text-amber-100 hover:border-amber-400/40 hover:scale-105 active:scale-95 cursor-pointer"
                                : "bg-white/[0.02] text-white/25 border border-white/5 cursor-not-allowed"
                        }`}
                      >
                        {cartelaNumber}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          {/* Selected Cartellas Grid */}
          {selectedNumbers.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-white/80 text-sm font-semibold">
                    {t("cs.your_cartellas", {
                      n: selectedNumbers.length,
                      max: maxCartellas,
                    })}
                  </h3>
                </div>
                {selectedNumbers.length > 0 && (
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          t("cs.remove_all_confirm", {
                            n: selectedNumbers.length,
                          }),
                        )
                      ) {
                        selectedNumbers.forEach((num) => deselectCartella(num));
                      }
                    }}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    {t("cs.remove_all")}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selectedNumbers.map((number) => {
                  const cardData = cards[number - 1];
                  if (!cardData) return null;

                  return (
                    <div
                      key={number}
                      className="bg-white/5 backdrop-blur rounded-xl p-2 border border-amber-400/20 relative"
                    >
                      <button
                        onClick={() => handleRemoveCartella(number)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors z-10"
                        title={t("cs.remove_cartella_title")}
                      >
                        ✕
                      </button>
                      <CartellaCard
                        id={number}
                        card={cardData}
                        called={gameState.calledNumbers || []}
                        isPreview={true}
                        showHeader={false}
                      />
                      <div className="text-center mt-1">
                        <span className="text-white/50 text-xs">#{number}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Waiting Message */}
          {gameState.phase !== "registration" &&
            gameState.phase !== "waiting" &&
            selectedNumbers.length === 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-center">
                <div className="text-3xl mb-2">⏳</div>
                <p className="text-amber-300/80 text-sm font-medium">
                  {t("cs.game_in_progress")}
                </p>
                <p className="text-white/40 text-xs mt-1">
                  {t("cs.reg_after")}
                </p>
              </div>
            )}

          {gameState.phase === "waiting" && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-white/70 text-sm font-medium">
                {t("cs.connecting_room")}
              </p>
              <p className="text-white/40 text-xs mt-1">
                {t("cs.preparing_stake", { stake })}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
