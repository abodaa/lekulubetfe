import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import CartellaCard from "../components/CartellaCard";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../lib/auth/AuthProvider";
import { useToast } from "../contexts/ToastContext";
import {
  playNumberSound,
  preloadNumberSounds,
  initAudio,
  resumeAudio,
  stopAllSounds,
} from "../lib/audio/numberSounds";
import "../styles/bingo-balls.css";
import "../styles/action-buttons.css";
import { BiRefresh } from "react-icons/bi";
import { LiaToggleOffSolid, LiaToggleOnSolid } from "react-icons/lia";
import { BsInfoCircle } from "react-icons/bs";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Memoized CartellaCard to prevent unnecessary re-renders
const MemoizedCartellaCard = React.memo(
  CartellaCard,
  (prevProps, nextProps) => {
    const calledChanged = prevProps.called?.length !== nextProps.called?.length;
    const cardChanged = prevProps.card !== nextProps.card;
    const idChanged = prevProps.id !== nextProps.id;
    const autoMarkChanged = prevProps.isAutoMarkOn !== nextProps.isAutoMarkOn;
    const winningPatternChanged =
      prevProps.showWinningPattern !== nextProps.showWinningPattern;
    return !(
      calledChanged ||
      cardChanged ||
      idChanged ||
      autoMarkChanged ||
      winningPatternChanged
    );
  },
);

export default function GameLayout({ stake, onNavigate }) {
  const { sessionId } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [showTimeout, setShowTimeout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertBanners, setAlertBanners] = useState([]);
  const alertTimersRef = useRef(new Map());

  const checkBingoPattern = useCallback((cartella, calledNumbers) => {
    if (!cartella || !Array.isArray(cartella) || cartella.length !== 5)
      return false;
    if (!calledNumbers || !Array.isArray(calledNumbers)) return false;

    const calledSet = new Set(calledNumbers);

    for (let i = 0; i < 5; i++) {
      if (!cartella[i] || !Array.isArray(cartella[i])) continue;
      if (cartella[i].every((num) => num === 0 || calledSet.has(num)))
        return true;
    }

    for (let j = 0; j < 5; j++) {
      let complete = true;
      for (let i = 0; i < 5; i++) {
        const num = cartella[i][j];
        if (num !== 0 && !calledSet.has(num)) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }

    let diag1Complete = true;
    for (let i = 0; i < 5; i++) {
      const num = cartella[i][i];
      if (num !== 0 && !calledSet.has(num)) {
        diag1Complete = false;
        break;
      }
    }
    if (diag1Complete) return true;

    let diag2Complete = true;
    for (let i = 0; i < 5; i++) {
      const num = cartella[i][4 - i];
      if (num !== 0 && !calledSet.has(num)) {
        diag2Complete = false;
        break;
      }
    }
    if (diag2Complete) return true;

    const corners = [
      cartella[0]?.[0],
      cartella[0]?.[4],
      cartella[4]?.[0],
      cartella[4]?.[4],
    ];
    const cornersComplete = corners.every((num) => {
      if (num === 0) return true;
      return calledSet.has(num);
    });
    if (cornersComplete) return true;

    return false;
  }, []);

  const { connected, gameState, claimBingo, connectToStake } = useWebSocket();

  const currentPrizePool = gameState.prizePool || 0;
  const calledNumbers = gameState.calledNumbers || [];
  const currentNumber = gameState.currentNumber;
  const currentGameId = gameState.gameId;
  const yourCards = Array.isArray(gameState.yourCards)
    ? gameState.yourCards
    : [];

  const calledNumbersSet = useMemo(
    () => new Set(calledNumbers),
    [calledNumbers],
  );

  const [isSoundOn, setIsSoundOn] = useState(() => {
    try {
      const saved = localStorage.getItem("lekulu_sound_enabled");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  // Keep the latest sound-on value in a ref so the play effect can read it
  // without re-running when it toggles (prevents re-announcing on unmute).
  const isSoundOnRef = useRef(isSoundOn);
  useEffect(() => {
    isSoundOnRef.current = isSoundOn;
  }, [isSoundOn]);
  // Last number we already handled, so we never replay it on unmute/re-render.
  const lastPlayedNumberRef = useRef(null);
  // Burst-coalescing announce: a guaranteed-to-fire timer that voices only the
  // most recent pending number, so a reconnect catch-up never replays the
  // backlog and the timer can never be starved into silence.
  const pendingNumberRef = useRef(null);
  const announceTimerRef = useRef(null);
  const [isAutoMarkOn, setIsAutoMarkOn] = useState(true);
  const [manuallyMarkedNumbers, setManuallyMarkedNumbers] = useState({});
  const [claimingStates, setClaimingStates] = useState({});
  const [startCountdown, setStartCountdown] = useState(0);
  const [missedWinningPatterns, setMissedWinningPatterns] = useState({});
  const [wallet, setWallet] = useState({ main: 0, bonus: 0 });

  const swiperRef = useRef(null);
  // Which cartella slide is currently centered — drives the fixed bottom BINGO bar.
  const [activeIndex, setActiveIndex] = useState(0);
  const claimedCartellasRef = useRef(new Set());
  const lastGameIdRef = useRef(null);
  const missedPatternsPersistentRef = useRef({});
  const [missedPatterns, setMissedPatterns] = useState({});
  const audioInitializedRef = useRef(false);
  const hasNavigatedToWinnerRef = useRef(false);

  // ========== NETWORK RECOVERY - Update manual marks for recovered numbers ==========
  const updateManualMarksForNumbers = useCallback(
    (numbers) => {
      if (isAutoMarkOn) return;

      setManuallyMarkedNumbers((prev) => {
        const newMarks = { ...prev };
        yourCards.forEach(({ cardNumber, card }) => {
          numbers.forEach((number) => {
            let hasNumber = false;
            if (card && Array.isArray(card)) {
              card.forEach((row) => {
                if (row && row.includes(number)) hasNumber = true;
              });
            }

            if (hasNumber) {
              const currentMarks = prev[cardNumber] || new Set();
              const updatedMarks = new Set(currentMarks);
              if (!updatedMarks.has(number)) {
                updatedMarks.add(number);
                newMarks[cardNumber] = updatedMarks;
              }
            }
          });
        });
        return newMarks;
      });
    },
    [isAutoMarkOn, yourCards],
  );

  // ========== NETWORK RECOVERY - Listen for numbers recovered from WebSocket ==========
  useEffect(() => {
    const handleNumbersRecovered = (event) => {
      const { numbers } = event.detail;
      console.log(
        `🔁 Network recovery: Restored ${numbers.length} missed numbers`,
      );

      if (!isAutoMarkOn && numbers.length > 0) {
        updateManualMarksForNumbers(numbers);
      }

      if (numbers.length > 0) {
        showSuccess(`Game synced: ${numbers.length} numbers restored`);
      }
    };

    window.addEventListener("numbersRecovered", handleNumbersRecovered);
    return () =>
      window.removeEventListener("numbersRecovered", handleNumbersRecovered);
  }, [isAutoMarkOn, updateManualMarksForNumbers, showSuccess]);

  useEffect(() => {
    if (isAutoMarkOn && Object.keys(manuallyMarkedNumbers).length > 0)
      setManuallyMarkedNumbers({});
  }, [isAutoMarkOn]);

  useEffect(() => {
    if (stake && sessionId) connectToStake(stake);
  }, [stake, sessionId, connectToStake]);

  useEffect(() => {
    const h = () => {
      if (document.visibilityState === "visible" && stake && sessionId) {
        setTimeout(() => {
          if (!connected) connectToStake(stake);
        }, 100);
      }
    };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, [stake, sessionId, connected, connectToStake]);

  // Audio initialization
  useEffect(() => {
    const initAudioOnInteraction = async () => {
      if (!audioInitializedRef.current) {
        audioInitializedRef.current = true;
        await initAudio().catch(() => {});
        await preloadNumberSounds().catch(() => {});
      }
      document.removeEventListener("click", initAudioOnInteraction);
      document.removeEventListener("touchstart", initAudioOnInteraction);
    };

    document.addEventListener("click", initAudioOnInteraction);
    document.addEventListener("touchstart", initAudioOnInteraction);

    return () => {
      document.removeEventListener("click", initAudioOnInteraction);
      document.removeEventListener("touchstart", initAudioOnInteraction);
    };
  }, []);

  // Play sound when a NEW number is called. Reads sound-on via a ref so toggling
  // it doesn't re-run this effect (no spurious re-announcing). Each number is
  // marked handled even while muted; the toggle handler announces the current
  // number on unmute.
  useEffect(() => {
    if (!currentNumber) return;
    if (startCountdown > 0) return;
    if (gameState.phase !== "running") return;
    if (currentNumber === lastPlayedNumberRef.current) return;

    // Remember the most recent number to voice.
    pendingNumberRef.current = currentNumber;

    // If an announce is already scheduled, don't reschedule — the existing timer
    // will voice whatever the latest pending number is when it fires. This means
    // a reconnect burst (many numbers arriving at once) collapses to a single
    // announce of the LATEST number, and the timer is never cancelled, so sound
    // can never be starved into silence.
    if (announceTimerRef.current != null) return;

    announceTimerRef.current = setTimeout(() => {
      announceTimerRef.current = null;
      const n = pendingNumberRef.current;
      pendingNumberRef.current = null;
      if (n == null || n === lastPlayedNumberRef.current) return;
      lastPlayedNumberRef.current = n; // mark handled even if muted
      if (!isSoundOnRef.current) return;
      playNumberSound(n).catch(() => {});
    }, 220);
  }, [currentNumber, startCountdown, gameState.phase]);

  // Clear the pending announce timer on unmount.
  useEffect(
    () => () => {
      if (announceTimerRef.current != null) {
        clearTimeout(announceTimerRef.current);
        announceTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (currentGameId !== lastGameIdRef.current) {
      claimedCartellasRef.current.clear();
      lastGameIdRef.current = currentGameId;
      setClaimingStates({});
      setMissedPatterns({});
      missedPatternsPersistentRef.current = {};
      hasNavigatedToWinnerRef.current = false;
    }
  }, [currentGameId]);

  const handleNumberToggle = useCallback(
    (cardNumber, number) => {
      if (isAutoMarkOn) return;
      setManuallyMarkedNumbers((prev) => {
        const cardMarks = prev[cardNumber] || new Set();
        const newCardMarks = new Set(cardMarks);
        newCardMarks.has(number)
          ? newCardMarks.delete(number)
          : newCardMarks.add(number);
        return { ...prev, [cardNumber]: newCardMarks };
      });
    },
    [isAutoMarkOn],
  );

  // Manual BINGO claim - user triggered only
  const handleCartellaBingo = useCallback(
    async (cardNumber) => {
      if (!connected || gameState.phase !== "running" || !currentGameId) {
        showError("Cannot claim BINGO right now");
        return;
      }

      if (claimedCartellasRef.current.has(cardNumber)) {
        showError(`Cartella #${cardNumber} already won`);
        return;
      }

      if (claimingStates[cardNumber]) return;

      // Manual mode: only a real, complete pattern counts. If the called numbers
      // don't form a winning pattern on this card yet, show "No Bingo" and stop —
      // never claim, never flip the button/cartella to WON.
      const entry = (yourCards || []).find((c) => c.cardNumber === cardNumber);
      const cardData = entry?.card;
      if (!cardData || !checkBingoPattern(cardData, calledNumbers)) {
        showError("No Bingo");
        return;
      }

      try {
        setClaimingStates((prev) => ({ ...prev, [cardNumber]: true }));

        const result = claimBingo({ cardNumber });

        if (!result) {
          showError(`Failed to claim BINGO for Cartella #${cardNumber}`);
        } else {
          showSuccess(`🎉 BINGO claimed for Cartella #${cardNumber}!`);
          claimedCartellasRef.current.add(cardNumber);
          setMissedPatterns((prev) => {
            const newPatterns = { ...prev };
            delete newPatterns[cardNumber];
            return newPatterns;
          });
          delete missedPatternsPersistentRef.current[cardNumber];
        }
      } catch (err) {
        showError(
          `Failed to claim BINGO for Cartella #${cardNumber} error: ${err.message || err}`,
        );
      } finally {
        setClaimingStates((prev) => ({ ...prev, [cardNumber]: false }));
      }
    },
    [
      claimBingo,
      connected,
      currentGameId,
      gameState.phase,
      claimingStates,
      yourCards,
      calledNumbers,
      checkBingoPattern,
      showError,
      showSuccess,
    ],
  );

  // Track missed winning patterns (visual only)
  useEffect(() => {
    if (gameState.phase !== "running") {
      setMissedWinningPatterns({});
      return;
    }
    if (yourCards.length === 0) return;
    if (calledNumbers.length === 0) return;

    const newMissedPatterns = { ...missedWinningPatterns };

    for (const { cardNumber, card } of yourCards) {
      if (claimedCartellasRef.current.has(cardNumber)) {
        if (newMissedPatterns[cardNumber]) delete newMissedPatterns[cardNumber];
        continue;
      }

      const hasWinNow = checkBingoPattern(card, calledNumbers);
      const previousCalled = calledNumbers.slice(0, -1);
      const hadWinBefore =
        previousCalled.length > 0
          ? checkBingoPattern(card, previousCalled)
          : false;

      if (hadWinBefore && !hasWinNow) {
        if (!newMissedPatterns[cardNumber]) {
          newMissedPatterns[cardNumber] = previousCalled;
        }
      }

      if (hasWinNow && newMissedPatterns[cardNumber]) {
        delete newMissedPatterns[cardNumber];
      }
    }

    setMissedWinningPatterns(newMissedPatterns);
  }, [calledNumbers, gameState.phase, yourCards, checkBingoPattern]);

  // Navigate to winner page when game finishes
  useEffect(() => {
    if (gameState.phase === "announce" && !hasNavigatedToWinnerRef.current) {
      hasNavigatedToWinnerRef.current = true;
      console.log(
        "🏆 Game finished - navigating to winner page. Winners:",
        gameState.winners?.length,
      );

      if (gameState.youWon) {
        showSuccess(`🎉 Congratulations! You won ${gameState.yourPrize} ETB!`);
        setWallet((prev) => ({
          ...prev,
          main: (prev.main || 0) + (gameState.yourPrize || 0),
        }));
      }

      // Navigate to winner page - don't clear any data
      onNavigate?.("winner");
    }
  }, [
    gameState.phase,
    gameState.youWon,
    gameState.yourPrize,
    showSuccess,
    onNavigate,
  ]);

  // Reset navigation flag when registration starts
  useEffect(() => {
    if (gameState.phase === "registration") {
      hasNavigatedToWinnerRef.current = false;
    }
  }, [gameState.phase]);

  useEffect(() => {
    if (gameState.phase !== "running") {
      setStartCountdown(0);
      return;
    }
    if (gameState.phase === "running" && calledNumbers.length === 0)
      setStartCountdown(3);
  }, [gameState.phase, calledNumbers.length, currentGameId]);

  useEffect(() => {
    if (startCountdown <= 0) return;
    const t = setTimeout(
      () => setStartCountdown((prev) => (prev > 0 ? prev - 1 : 0)),
      1000,
    );
    return () => clearTimeout(t);
  }, [startCountdown]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      await new Promise((r) => setTimeout(r, 100));
      if (stake && sessionId) {
        connectToStake(stake);
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      showError("Failed to refresh game state.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!currentGameId) {
      const t = setTimeout(() => setShowTimeout(true), 5000);
      return () => clearTimeout(t);
    } else setShowTimeout(false);
  }, [currentGameId]);

  useEffect(() => {
    if (gameState.phase === "registration") {
      setShowTimeout(false);
      setIsRefreshing(false);
      claimedCartellasRef.current.clear();
      setClaimingStates({});
      setMissedPatterns({});
      missedPatternsPersistentRef.current = {};
    }
  }, [gameState.phase]);

  useEffect(() => {
    const h = (event) => {
      const reason = event?.detail?.reason || "invalid_claim";
      const cardNumber = event?.detail?.cardNumber;

      // A rejection means this cartella did NOT win — undo any optimistic WON
      // marker and clear its claiming state so it never stays shown as WON.
      if (cardNumber != null) {
        claimedCartellasRef.current.delete(cardNumber);
        setClaimingStates((prev) => ({ ...prev, [cardNumber]: false }));
      }

      if (reason === "invalid_claim") {
        setManuallyMarkedNumbers({});
        setAlertBanners((prev) => [...prev, "Invalid BINGO! Marks cleared."]);
      } else if (reason === "stale_claim") {
        setAlertBanners((prev) => [
          ...prev,
          "You missed that winning pattern. Keep playing for the next one!",
        ]);
        if (cardNumber) {
          setMissedPatterns((prev) => ({
            ...prev,
            [cardNumber]: [...calledNumbers],
          }));
          missedPatternsPersistentRef.current[cardNumber] = [...calledNumbers];
        }
      }
    };
    window.addEventListener("bingoRejected", h);
    return () => window.removeEventListener("bingoRejected", h);
  }, [calledNumbers]);

  useEffect(() => {
    const current = new Set(alertBanners);
    alertTimersRef.current.forEach((timer, msg) => {
      if (!current.has(msg)) {
        clearTimeout(timer);
        alertTimersRef.current.delete(msg);
      }
    });
    alertBanners.forEach((msg) => {
      if (!alertTimersRef.current.has(msg)) {
        const t = setTimeout(() => {
          setAlertBanners((prev) => prev.filter((m) => m !== msg));
          alertTimersRef.current.delete(msg);
        }, 3000);
        alertTimersRef.current.set(msg, t);
      }
    });
  }, [alertBanners]);

  useEffect(() => {
    return () => {
      alertTimersRef.current.forEach((t) => clearTimeout(t));
      alertTimersRef.current.clear();
    };
  }, []);

  // Wallet update handler
  useEffect(() => {
    const handleWalletUpdate = (event) => {
      if (event.detail && event.detail.type === "wallet_update") {
        const { main, bonus } = event.detail.payload;
        setWallet((prev) => ({
          ...prev,
          main: main !== undefined ? main : prev.main,
          bonus: bonus !== undefined ? bonus : prev.bonus,
        }));
      }
    };
    window.addEventListener("walletUpdate", handleWalletUpdate);
    return () => window.removeEventListener("walletUpdate", handleWalletUpdate);
  }, []);

  const handleSoundToggle = () => {
    const newState = !isSoundOn;
    setIsSoundOn(newState);
    isSoundOnRef.current = newState; // immediate, before the sync effect runs
    localStorage.setItem("lekulu_sound_enabled", newState.toString());
    if (newState) {
      // Unmuting: just enable audio. Do NOT replay the number already on screen
      // (it's already marked handled), so toggling stays silent until the next
      // new number is drawn.
      if (!audioInitializedRef.current) {
        audioInitializedRef.current = true;
        initAudio().catch(() => {});
        resumeAudio().catch(() => {});
      }
      lastPlayedNumberRef.current =
        currentNumber || lastPlayedNumberRef.current;
    } else {
      // Muting: stop whatever is playing right now, immediately.
      stopAllSounds();
    }
  };

  // Memoized number board
  const NumberBoard = useMemo(
    () => (
      <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl my-2 border border-white/10 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <table className="w-full border-collapse">
          <tbody>
            {[
              {
                letter: "B",
                color: "bg-white/[0.04] text-sky-300",
                start: 1,
                end: 15,
              },
              {
                letter: "I",
                color: "bg-white/[0.04] text-emerald-300",
                start: 16,
                end: 30,
              },
              {
                letter: "N",
                color: "bg-white/[0.04] text-violet-300",
                start: 31,
                end: 45,
              },
              {
                letter: "G",
                color: "bg-white/[0.04] text-rose-300",
                start: 46,
                end: 60,
              },
              {
                letter: "O",
                color: "bg-white/[0.04] text-amber-300",
                start: 61,
                end: 75,
              },
            ].map(({ letter, color, start, end }) => (
              <tr key={letter}>
                <td
                  className={`text-center text-[12px] font-black py-0.5 w-[8%] ${color}`}
                >
                  {letter}
                </td>
                {Array.from(
                  { length: end - start + 1 },
                  (_, i) => start + i,
                ).map((n) => {
                  const isCalled = calledNumbersSet.has(n);
                  const isCurrent = currentNumber === n;
                  return (
                    <td
                      key={n}
                      className={`text-center text-[12px] py-0.5 font-bold transition-colors duration-150 ${
                        isCurrent
                          ? "bg-gradient-to-b from-amber-400 to-orange-500 text-slate-900 rounded-full font-black scale-105 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                          : isCalled
                            ? "bg-white/20 text-white rounded-full"
                            : "text-white/20"
                      }`}
                    >
                      {n}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    [calledNumbersSet, currentNumber],
  );

  // Conditional returns
  if (isRefreshing) {
    return (
      <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mx-auto mb-4" />
          <p className="text-white/80 text-lg font-bold">Refreshing...</p>
        </div>
      </div>
    );
  }

  if (!currentGameId && !connected && !isRefreshing) {
    return (
      <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">🎮</div>
          <div className="text-white text-lg font-bold mb-2">Connecting...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
          {showTimeout && (
            <button
              onClick={() => onNavigate?.("cartela-selection")}
              className="px-6 py-3 bg-amber-500 text-slate-900 rounded-lg font-bold"
            >
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const gamePhaseDisplay =
    gameState.phase === "running"
      ? "LIVE"
      : gameState.phase === "registration"
        ? "REG"
        : "WAIT";
  const isWatchMode = yourCards.length === 0;

  // Active cartella (the centered slide) for the fixed bottom BINGO bar.
  const safeActiveIndex =
    yourCards.length > 0 ? Math.min(activeIndex, yourCards.length - 1) : 0;
  const activeCard = yourCards[safeActiveIndex] || null;
  const activeCardNumber = activeCard?.cardNumber ?? null;
  const activeAlreadyClaimed =
    activeCardNumber != null &&
    claimedCartellasRef.current.has(activeCardNumber);
  const activeIsClaiming =
    activeCardNumber != null && !!claimingStates[activeCardNumber];
  const activeHasWinning =
    activeCard && checkBingoPattern(activeCard.card, calledNumbers);
  const activeHasMissed =
    activeCardNumber != null && !!missedWinningPatterns[activeCardNumber];

  // When a game finishes (announce), this screen is on its way to the winner
  // screen. Rendering anything here would briefly flash watch-mode (cards are
  // already cleared), so render nothing for that frame.
  if (gameState.phase === "announce") return null;

  return (
    <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex flex-col">
      {alertBanners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
          {alertBanners.map((msg, i) => (
            <div
              key={i}
              className="alert-banner-appeal"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="alert-icon-wrapper">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="alert-message-text">{msg}</div>
              <button
                onClick={() =>
                  setAlertBanners((prev) => prev.filter((_, j) => j !== i))
                }
                className="alert-dismiss-btn"
                aria-label="Dismiss"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md mx-auto w-full flex flex-col h-[var(--app-height)]">
        <header className="px-3 pt-1.5 pb-0.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* <div
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                  gameState.phase === "running"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                    : gameState.phase === "registration"
                      ? "bg-amber-500/20 text-amber-300 border-amber-400/40"
                      : "bg-slate-500/20 text-slate-300 border-slate-400/30"
                }`}
              >
                {startCountdown > 0 ? startCountdown : gamePhaseDisplay}
              </div> */}
              <button
                onClick={handleSoundToggle}
                className={`px-2 py-1 rounded-lg flex items-center justify-center gap-1 text-xs font-bold transition-all ${
                  isSoundOn
                    ? "text-emerald-400 bg-emerald-500/20"
                    : "text-white/70 bg-white/20"
                }`}
                aria-label={isSoundOn ? "Mute" : "Unmute"}
              >
                <span>Sound</span>{" "}
                <span className="text-xl">
                  {isSoundOn ? <LiaToggleOnSolid /> : <LiaToggleOffSolid />}
                </span>
              </button>
              <button
                onClick={() => {
                  if (isAutoMarkOn) {
                    const autoMarks = {};
                    yourCards.forEach(({ cardNumber, card }) => {
                      const marks = new Set();
                      calledNumbers.forEach((num) => {
                        card.forEach((row) => {
                          if (row.includes(num)) marks.add(num);
                        });
                      });
                      if (marks.size > 0) autoMarks[cardNumber] = marks;
                    });
                    setManuallyMarkedNumbers(autoMarks);
                  }
                  setIsAutoMarkOn(!isAutoMarkOn);
                }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg font-bold ${isAutoMarkOn ? " text-emerald-400 bg-emerald-500/20" : "text-white/70 bg-white/20"}`}
              >
                <span>Auto</span>{" "}
                <span className="text-xl">
                  {isAutoMarkOn ? <LiaToggleOnSolid /> : <LiaToggleOffSolid />}
                </span>
              </button>
              <button
                onClick={handleRefresh}
                className="px-2 py-1 rounded-lg flex items-center justify-center text-xs bg-white/20 text-white/70 font-bold"
              >
                <p>Refresh</p>
              </button>
            </div>
            <div className="text-right px-2 py-1 rounded-lg bg-white/10 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                Game
              </div>
              <div className="text-white/70 text-[10px] font-bold font-mono">
                {currentGameId ? currentGameId.replace("LB", "#") : "---"}
              </div>
            </div>
          </div>
        </header>

        {/* Draw + previously called numbers */}
        {!isWatchMode && (
          <div className="px-3 pt-1 pb-1.5 flex-shrink-0">
            <div className="flex items-center gap-2">
              {/* Derash / prize */}
              <div className="flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl bg-gradient-to-b from-amber-500/20 to-amber-600/5 border border-amber-400/50 shadow-[0_0_14px_rgba(245,158,11,0.18)] flex-shrink-0">
                <span className="text-amber-300/70 text-[8px] font-bold uppercase tracking-wide leading-none">
                  Derash
                </span>
                <span className="text-amber-300 font-extrabold text-sm leading-tight whitespace-nowrap">
                  {currentPrizePool || 0} ETB
                </span>
              </div>

              {/* Current draw ball */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full bg-gradient-to-b from-white to-slate-200 border border-white/70 shadow-[0_4px_14px_rgba(0,0,0,0.45)] flex items-center justify-center">
                  <span className="text-slate-900 font-black text-xl font-mono leading-none">
                    {currentNumber || "--"}
                  </span>
                </div>
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white shadow" />
              </div>

              {/* Recently called */}
              <div className="flex-1 min-w-0 rounded-xl border border-sky-400/30 bg-white/[0.03] px-2 py-2 overflow-hidden">
                {calledNumbers.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    {calledNumbers
                      .slice(-4)
                      .reverse()
                      .map((n, i) => {
                        const letter =
                          n <= 15
                            ? "B"
                            : n <= 30
                              ? "I"
                              : n <= 45
                                ? "N"
                                : n <= 60
                                  ? "G"
                                  : "O";
                        const lc = {
                          B: "text-sky-300",
                          I: "text-emerald-300",
                          N: "text-violet-300",
                          G: "text-rose-300",
                          O: "text-amber-300",
                        };
                        return (
                          <div
                            key={`${n}-${i}`}
                            className="flex items-center gap-1 rounded-full bg-black/50 border border-white/10 pl-1.5 pr-2 py-1 flex-shrink-0"
                          >
                            <span
                              className={`text-[11px] font-extrabold ${lc[letter]}`}
                            >
                              {letter}
                            </span>
                            <span className="text-white text-xs font-bold font-mono">
                              {n}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-white/30 text-[11px] text-center font-medium">
                    Waiting for first call…
                  </p>
                )}
              </div>

              {/* Calls count */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-white/70 text-xs font-bold whitespace-nowrap">
                  {calledNumbers.length}/75
                </span>
              </div>
            </div>
          </div>
        )}

        {!isWatchMode && startCountdown > 0 && calledNumbers.length === 0 && (
          <p className="text-white text-[11px] uppercase tracking-widest font-bold mb-1 text-center">
            Starts in {startCountdown ? startCountdown : "0"} secs
          </p>
        )}

        {/* Number Board */}
        {!isWatchMode && NumberBoard}

        <main className="flex-1 px-3 pb-1.5 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            {yourCards.length > 0 ? (
              <div className="relative h-full">
                <Swiper
                  modules={[Navigation, Pagination]}
                  spaceBetween={16}
                  slidesPerView={1}
                  centeredSlides={true}
                  loop={true}
                  pagination={false}
                  navigation={{
                    prevEl: ".swiper-button-prev-custom",
                    nextEl: ".swiper-button-next-custom",
                  }}
                  onSwiper={(swiper) => {
                    swiperRef.current = swiper;
                    setActiveIndex(swiper.realIndex ?? 0);
                  }}
                  onSlideChange={(swiper) =>
                    setActiveIndex(swiper.realIndex ?? 0)
                  }
                  className="w-full h-full"
                  style={{ paddingBottom: "0px" }}
                >
                  {yourCards.map(({ cardNumber, card }) => {
                    const markedNumbers = isAutoMarkOn
                      ? calledNumbers
                      : manuallyMarkedNumbers[cardNumber]
                        ? Array.from(manuallyMarkedNumbers[cardNumber])
                        : [];

                    const hasWinningPattern = checkBingoPattern(
                      card,
                      calledNumbers,
                    );
                    const isClaiming = claimingStates[cardNumber];
                    const alreadyClaimed =
                      claimedCartellasRef.current.has(cardNumber);
                    const hasMissedPattern =
                      !!missedWinningPatterns[cardNumber];
                    return (
                      <SwiperSlide key={cardNumber}>
                        <div className="px-1 pb-1 h-full flex flex-col">
                          <div
                            className={`bg-gradient-to-b from-white/[0.07] to-white/[0.02] backdrop-blur-xl rounded-2xl p-2 border w-full flex flex-col flex-1 min-h-0 shadow-[0_8px_32px_rgba(0,0,0,0.35)] ${
                              hasMissedPattern &&
                              !alreadyClaimed &&
                              !isAutoMarkOn
                                ? "border-red-500/50 bg-red-500/10"
                                : hasWinningPattern &&
                                    !alreadyClaimed &&
                                    !isAutoMarkOn
                                  ? "border-emerald-500/50 bg-emerald-500/10"
                                  : "border-white/10"
                            }`}
                          >
                            <MemoizedCartellaCard
                              id={cardNumber}
                              card={card}
                              called={
                                isAutoMarkOn
                                  ? [
                                      ...new Set([
                                        ...calledNumbers,
                                        ...(manuallyMarkedNumbers[cardNumber]
                                          ? Array.from(
                                              manuallyMarkedNumbers[cardNumber],
                                            )
                                          : []),
                                      ]),
                                    ]
                                  : markedNumbers
                              }
                              isPreview={false}
                              showHeader={false}
                              isAutoMarkOn={isAutoMarkOn}
                              onNumberToggle={
                                !isAutoMarkOn
                                  ? (number) =>
                                      handleNumberToggle(cardNumber, number)
                                  : undefined
                              }
                              missedWinningCalledNumbers={
                                missedWinningPatterns[cardNumber] || null
                              }
                              size="fill"
                            />
                          </div>
                        </div>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>

                {yourCards.length > 1 && (
                  <>
                    <button
                      className="swiper-button-prev-custom absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all shadow-lg"
                      onClick={() => swiperRef.current?.slidePrev()}
                    >
                      <MdKeyboardArrowLeft size={20} />
                    </button>
                    <button
                      className="swiper-button-next-custom absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 active:scale-95 transition-all shadow-lg"
                      onClick={() => swiperRef.current?.slideNext()}
                    >
                      <MdKeyboardArrowRight size={20} />
                    </button>
                  </>
                )}
              </div>
            ) : isWatchMode ? (
              <div className="flex items-center justify-center h-full max-w-full mx-auto overflow-hidden">
                <div className="text-center px-6">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 mx-auto rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center">
                      <div className="text-5xl animate-pulse">👀</div>
                    </div>
                  </div>
                  <h3 className="text-white text-xl font-black mb-2 tracking-wide">
                    Watch Mode
                  </h3>
                  <p className="text-white/40 text-sm font-bold mb-4">
                    Game currently in progress
                  </p>
                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-white/30 text-xs font-bold">
                        Live
                      </span>
                    </div>
                    <div className="text-white/10">|</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/30 text-xs font-bold">
                        Players
                      </span>
                      <span className="text-white/50 text-xs font-extrabold">
                        {gameState.playersCount || 0}
                      </span>
                    </div>
                  </div>
                  <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-4 mb-6 max-w-[280px] shadow-[0_8px_32px_rgba(0,0,0,0.35)]">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl text-white">
                        <BsInfoCircle />
                      </span>
                      <div className="text-left">
                        <p className="text-white/60 text-xs font-bold mb-1">
                          You will automatically join the next available game
                        </p>
                        <p className="text-white/30 text-[10px] leading-relaxed">
                          Stay on this screen. When a new round begins, you'll
                          be taken to cartella selection.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-white/20 animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>

        {!isWatchMode && yourCards.length > 0 && (
          <div className="flex-shrink-0 px-3 pb-3 pt-1">
            {(activeAlreadyClaimed || (!isAutoMarkOn && activeHasMissed)) && (
              <div className="flex justify-center mb-1.5">
                {activeAlreadyClaimed ? (
                  <span className="text-emerald-300 text-[10px] font-bold bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                    WON ✓
                  </span>
                ) : (
                  <span className="text-red-300 text-[10px] font-bold bg-red-500/20 border border-red-400/30 px-2.5 py-0.5 rounded-full">
                    MISSED PATTERN
                  </span>
                )}
              </div>
            )}
            <div className="flex items-stretch gap-2.5">
              {/* Active cartella + slide position */}
              <div className="flex flex-col items-center justify-center px-3 py-2 rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 min-w-[64px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <span className="text-white/40 text-[8px] uppercase tracking-wide leading-none">
                  Cartella
                </span>
                <span className="text-white font-extrabold text-base leading-tight">
                  #{activeCardNumber}
                </span>
                {yourCards.length > 1 && (
                  <span className="text-amber-300/80 text-[10px] font-bold leading-none">
                    {safeActiveIndex + 1}/{yourCards.length}
                  </span>
                )}
              </div>

              {/* Fixed BINGO action for the active cartella */}
              <button
                onClick={() =>
                  activeCardNumber != null &&
                  handleCartellaBingo(activeCardNumber)
                }
                disabled={
                  isAutoMarkOn || activeIsClaiming || activeAlreadyClaimed
                }
                className={`flex-1 rounded-2xl text-xl font-extrabold tracking-wide transition-all ${
                  activeAlreadyClaimed
                    ? "bg-white/10 text-emerald-300 cursor-not-allowed"
                    : isAutoMarkOn
                      ? "bg-gradient-to-b from-slate-600/80 to-slate-700/80 text-white/70 cursor-not-allowed"
                      : activeHasWinning
                        ? "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-[0_6px_24px_rgba(245,158,11,0.55)] hover:brightness-110 active:scale-[0.98] animate-pulse"
                        : "bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 shadow-[0_6px_20px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-[0.98]"
                }`}
              >
                {activeIsClaiming
                  ? "Claiming…"
                  : activeAlreadyClaimed
                    ? "✓ WON"
                    : isAutoMarkOn
                      ? "AUTO MARK ON"
                      : "BINGO!"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
