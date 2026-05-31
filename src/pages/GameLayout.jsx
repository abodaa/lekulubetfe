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
} from "../lib/audio/numberSounds";
import "../styles/bingo-balls.css";
import "../styles/action-buttons.css";
import { motion, AnimatePresence } from "framer-motion";
import { CgLivePhoto } from "react-icons/cg";
import { BiRefresh } from "react-icons/bi";
import { LiaToggleOffSolid, LiaToggleOnSolid } from "react-icons/lia";
import { BsInfoCircle } from "react-icons/bs";
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from "react-icons/md";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Memoized CartellaCard wrapper to prevent unnecessary re-renders
const MemoizedCartellaCard = React.memo(
  CartellaCard,
  (prevProps, nextProps) => {
    return (
      prevProps.id === nextProps.id &&
      prevProps.card === nextProps.card &&
      prevProps.called?.length === nextProps.called?.length &&
      prevProps.isPreview === nextProps.isPreview &&
      prevProps.showWinningPattern === nextProps.showWinningPattern &&
      prevProps.isAutoMarkOn === nextProps.isAutoMarkOn &&
      prevProps.missedWinningCalledNumbers ===
        nextProps.missedWinningCalledNumbers
    );
  },
);

export default function GameLayout({ stake, onNavigate }) {
  const { sessionId } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertBanners, setAlertBanners] = useState([]);
  const alertTimersRef = useRef(new Map());

  const {
    connected,
    gameState,
    claimBingo,
    connectToStake,
    ws,
    forceReconnect,
  } = useWebSocket();

  // Use refs for frequently changing data to avoid re-renders
  const gameStateRef = useRef(gameState);
  const calledNumbersRef = useRef([]);
  const yourCardsRef = useRef([]);
  const currentGameIdRef = useRef(null);

  // Update refs when gameState changes
  useEffect(() => {
    gameStateRef.current = gameState;
    calledNumbersRef.current = gameState.calledNumbers || [];
    yourCardsRef.current = gameState.yourCards || [];
    currentGameIdRef.current = gameState.gameId;
  }, [gameState]);

  const [isSoundOn, setIsSoundOn] = useState(() => {
    try {
      const saved = localStorage.getItem("lekulu_sound_enabled");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });
  const [isAutoMarkOn, setIsAutoMarkOn] = useState(true);
  const [manuallyMarkedNumbers, setManuallyMarkedNumbers] = useState({});
  const [claimingStates, setClaimingStates] = useState({});
  const [startCountdown, setStartCountdown] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [missedWinningPatterns, setMissedWinningPatterns] = useState({});
  const [wallet, setWallet] = useState({ main: 0, bonus: 0 });
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const confettiRef = useRef(null);
  const swiperRef = useRef(null);
  const claimedCartellasRef = useRef(new Set());
  const lastGameIdRef = useRef(null);
  const audioInitializedRef = useRef(false);
  const frameRef = useRef(null);
  const lastCallNumberRef = useRef(null);
  const soundQueueRef = useRef([]);
  const isPlayingSoundRef = useRef(false);
  const pendingBingoClaimsRef = useRef([]);
  const isProcessingQueueRef = useRef(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // ========== MEMOIZED VALUES ==========
  const currentPrizePool = useMemo(
    () => gameState.prizePool || 0,
    [gameState.prizePool],
  );
  const calledNumbers = useMemo(
    () => gameState.calledNumbers || [],
    [gameState.calledNumbers],
  );
  const currentNumber = gameState.currentNumber;
  const currentGameId = gameState.gameId;
  const yourCards = useMemo(
    () => gameState.yourCards || [],
    [gameState.yourCards],
  );
  const isWatchMode = yourCards.length === 0;

  // ========== PERFORMANCE: Batch state updates with requestAnimationFrame ==========
  const batchUpdate = useCallback((updater) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      updater();
      frameRef.current = null;
    });
  }, []);

  // ========== SOUND QUEUE MANAGEMENT ==========
  const processSoundQueue = useCallback(async () => {
    if (
      !isSoundOn ||
      isPlayingSoundRef.current ||
      soundQueueRef.current.length === 0
    )
      return;
    if (startCountdown > 0 || gameStateRef.current.phase !== "running") {
      soundQueueRef.current = [];
      return;
    }

    isPlayingSoundRef.current = true;
    const number = soundQueueRef.current.shift();

    try {
      await playNumberSound(number);
    } catch (error) {
      // Silent fail
    } finally {
      isPlayingSoundRef.current = false;
      if (soundQueueRef.current.length > 0) {
        setTimeout(() => processSoundQueue(), 50);
      }
    }
  }, [isSoundOn, startCountdown]);

  const queueNumberSound = useCallback(
    (number) => {
      if (!isSoundOn || !number) return;
      if (lastCallNumberRef.current === number) return;

      lastCallNumberRef.current = number;
      soundQueueRef.current.push(number);

      if (!isPlayingSoundRef.current) {
        processSoundQueue();
      }
    },
    [isSoundOn, processSoundQueue],
  );

  // ========== CHECK BINGO PATTERN (OPTIMIZED) ==========
  const checkBingoPattern = useCallback((card, calledNumbersSet) => {
    if (!card || !calledNumbersSet) return false;

    // Check rows
    for (let i = 0; i < 5; i++) {
      const row = card[i];
      if (!row) continue;
      let complete = true;
      for (let j = 0; j < 5; j++) {
        const num = row[j];
        if (num !== 0 && !calledNumbersSet.has(num)) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }

    // Check columns
    for (let j = 0; j < 5; j++) {
      let complete = true;
      for (let i = 0; i < 5; i++) {
        const num = card[i][j];
        if (num !== 0 && !calledNumbersSet.has(num)) {
          complete = false;
          break;
        }
      }
      if (complete) return true;
    }

    // Check diagonals
    let diag1 = true;
    for (let i = 0; i < 5; i++) {
      const num = card[i][i];
      if (num !== 0 && !calledNumbersSet.has(num)) {
        diag1 = false;
        break;
      }
    }
    if (diag1) return true;

    let diag2 = true;
    for (let i = 0; i < 5; i++) {
      const num = card[i][4 - i];
      if (num !== 0 && !calledNumbersSet.has(num)) {
        diag2 = false;
        break;
      }
    }
    if (diag2) return true;

    // Check corners
    const corners = [card[0][0], card[0][4], card[4][0], card[4][4]];
    return corners.every((num) => num === 0 || calledNumbersSet.has(num));
  }, []);

  // ========== AUTO-BINGO WITH BATCH PROCESSING ==========
  useEffect(() => {
    if (gameStateRef.current.phase !== "running") return;
    if (!isAutoMarkOn) return;
    if (yourCardsRef.current.length === 0) return;
    if (calledNumbersRef.current.length === 0) return;

    const calledSet = new Set(calledNumbersRef.current);
    const lastCall =
      calledNumbersRef.current[calledNumbersRef.current.length - 1];

    for (const { cardNumber, card } of yourCardsRef.current) {
      if (claimedCartellasRef.current.has(cardNumber)) continue;

      const hasWin = checkBingoPattern(card, calledSet);
      if (!hasWin) continue;

      // Check if last call completes the pattern
      let lastCallCompletes = false;
      for (let i = 0; i < 5; i++) {
        if (card[i]?.includes(lastCall)) {
          lastCallCompletes = true;
          break;
        }
      }
      if (!lastCallCompletes) continue;

      claimedCartellasRef.current.add(cardNumber);

      batchUpdate(() => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
      });

      claimBingo({ cardNumber });
      showSuccess(`🎉 Auto-BINGO! Cartella #${cardNumber} won!`);
      break;
    }
  }, [
    calledNumbers,
    isAutoMarkOn,
    checkBingoPattern,
    claimBingo,
    showSuccess,
    batchUpdate,
  ]);

  // ========== SOUND EFFECT ==========
  useEffect(() => {
    if (!currentNumber) return;
    if (startCountdown > 0) return;
    if (gameStateRef.current.phase !== "running") return;

    queueNumberSound(currentNumber);
  }, [currentNumber, startCountdown, queueNumberSound]);

  // ========== CONNECTION MANAGEMENT ==========
  useEffect(() => {
    if (stake && sessionId) connectToStake(stake);
  }, [stake, sessionId, connectToStake]);

  // ========== HANDLE REFRESH ==========
  const handleRefresh = useCallback(() => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setTimeout(() => {
      if (stake && sessionId) connectToStake(stake);
      setIsRefreshing(false);
    }, 100);
  }, [isRefreshing, stake, sessionId, connectToStake]);

  // ========== SOUND TOGGLE ==========
  const handleSoundToggle = useCallback(() => {
    const newState = !isSoundOn;
    setIsSoundOn(newState);
    localStorage.setItem("lekulu_sound_enabled", newState.toString());

    if (!newState) {
      soundQueueRef.current = [];
      isPlayingSoundRef.current = false;
    } else if (!audioInitializedRef.current) {
      audioInitializedRef.current = true;
      initAudio().catch(() => {});
      resumeAudio().catch(() => {});
    }
  }, [isSoundOn]);

  // ========== AUTO MARK TOGGLE ==========
  const toggleAutoMark = useCallback(() => {
    const newMode = !isAutoMarkOn;

    if (!newMode) {
      // Switching to Manual mode - sync server numbers
      const serverCalled = calledNumbersRef.current;
      const newManualMarks = {};

      yourCardsRef.current.forEach(({ cardNumber, card }) => {
        const marks = new Set();
        serverCalled.forEach((num) => {
          if (card.some((row) => row.includes(num))) {
            marks.add(num);
          }
        });
        if (marks.size > 0) {
          newManualMarks[cardNumber] = marks;
        }
      });
      setManuallyMarkedNumbers(newManualMarks);
    } else {
      // Switching to Auto mode - clear manual marks
      setManuallyMarkedNumbers({});
    }

    setIsAutoMarkOn(newMode);
  }, [isAutoMarkOn]);

  // ========== HANDLE CARTELLA BINGO ==========
  const handleCartellaBingo = useCallback(
    async (cardNumber) => {
      const currentPhase = gameStateRef.current.phase;
      const currentGame = gameStateRef.current.gameId;

      if (!connected || currentPhase !== "running" || !currentGame) {
        showError("Cannot claim BINGO right now");
        return;
      }

      if (claimedCartellasRef.current.has(cardNumber)) {
        showError(`Cartella #${cardNumber} already won`);
        return;
      }

      const card = yourCardsRef.current.find(
        (c) => c.cardNumber === cardNumber,
      )?.card;
      if (!card) {
        showError(`Cartella #${cardNumber} not found`);
        return;
      }

      if (!isAutoMarkOn) {
        const calledSet = new Set(calledNumbersRef.current);
        if (!checkBingoPattern(card, calledSet)) {
          showError(`No winning pattern on Cartella #${cardNumber}`);
          return;
        }
      }

      if (claimingStates[cardNumber]) return;

      setClaimingStates((prev) => ({ ...prev, [cardNumber]: true }));
      batchUpdate(() => {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2000);
      });

      const result = claimBingo({ cardNumber });

      if (result) {
        showSuccess(`🎉 BINGO claimed for Cartella #${cardNumber}!`);
        claimedCartellasRef.current.add(cardNumber);
      } else {
        showError(`Failed to claim BINGO for Cartella #${cardNumber}`);
      }

      setClaimingStates((prev) => ({ ...prev, [cardNumber]: false }));
    },
    [
      connected,
      claimBingo,
      isAutoMarkOn,
      checkBingoPattern,
      showError,
      showSuccess,
      batchUpdate,
      claimingStates,
    ],
  );

  // ========== GAME FINISH HANDLER ==========
  useEffect(() => {
    if (gameState.phase === "announce" && !isRefreshing) {
      onNavigate?.("winner");
    }
  }, [gameState.phase, onNavigate, isRefreshing]);

  // ========== CLEANUP ==========
  useEffect(() => {
    if (gameState.phase === "registration") {
      claimedCartellasRef.current.clear();
      soundQueueRef.current = [];
      isPlayingSoundRef.current = false;
      lastCallNumberRef.current = null;
      setClaimingStates({});
      setMissedWinningPatterns({});
    }
  }, [gameState.phase]);

  useEffect(() => {
    if (currentGameId !== lastGameIdRef.current) {
      claimedCartellasRef.current.clear();
      lastGameIdRef.current = currentGameId;
      setClaimingStates({});
    }
  }, [currentGameId]);

  // ========== WALLET UPDATE ==========
  useEffect(() => {
    const handleWalletUpdate = (event) => {
      if (event.detail?.type === "wallet_update") {
        const { main, bonus } = event.detail.payload;
        setWallet((prev) => ({
          main: main !== undefined ? main : prev.main,
          bonus: bonus !== undefined ? bonus : prev.bonus,
        }));
      }
    };
    window.addEventListener("walletUpdate", handleWalletUpdate);
    return () => window.removeEventListener("walletUpdate", handleWalletUpdate);
  }, []);

  // ========== ALERT BANNERS ==========
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

  // ========== COUNTDOWN EFFECT ==========
  useEffect(() => {
    if (gameState.phase !== "running") {
      setStartCountdown(0);
      return;
    }
    if (calledNumbers.length === 0) setStartCountdown(3);
  }, [gameState.phase, calledNumbers.length]);

  useEffect(() => {
    if (startCountdown <= 0) return;
    const t = setTimeout(() => setStartCountdown((prev) => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [startCountdown]);

  // ========== PRELOAD AUDIO ==========
  useEffect(() => {
    preloadNumberSounds().catch(() => {});
  }, []);

  // ========== OFFLINE INDICATOR ==========
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // ========== NETWORK RECOVERY - RELOAD PAGE ==========
  useEffect(() => {
    let reloadTimer = null;
    let periodicCheckInterval = null;

    const triggerReload = () => {
      if (reloadTimer) return;
      if (stake) sessionStorage.setItem("reconnect_stake", stake);
      showWarning("Network recovered! Refreshing game in 3 seconds...");
      reloadTimer = setTimeout(() => window.location.reload(), 3000);
    };

    const checkConnection = () => {
      if (navigator.onLine && !connected && currentGameId && !isRefreshing) {
        triggerReload();
      }
    };

    window.addEventListener("online", () =>
      setTimeout(() => checkConnection(), 2000),
    );
    window.addEventListener("offline", () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = null;
    });

    periodicCheckInterval = setInterval(checkConnection, 5000);

    return () => {
      if (periodicCheckInterval) clearInterval(periodicCheckInterval);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, [connected, currentGameId, isRefreshing, stake, showWarning]);

  // ========== RENDER HELPERS ==========
  const gamePhaseDisplay =
    gameState.phase === "running"
      ? "LIVE"
      : gameState.phase === "registration"
        ? "REG"
        : "WAIT";

  // Loading state
  if (isRefreshing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mx-auto mb-4" />
          <p className="text-white/80 text-lg font-bold">Refreshing...</p>
        </div>
      </div>
    );
  }

  if (!currentGameId && !connected && !isRefreshing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">🎮</div>
          <div className="text-white text-lg font-bold mb-2">Connecting...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-1 text-xs font-medium">
          ⚠️ You're offline - wins will be stored and claimed when online
        </div>
      )}

      {alertBanners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
          {alertBanners.map((msg, i) => (
            <div
              key={i}
              className="bg-gray-900/90 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white text-sm flex items-center gap-3 shadow-lg"
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

      <div className="max-w-md mx-auto w-full flex flex-col h-screen">
        {/* Header */}
        <header className="px-3 pt-2 pb-1 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                  gameState.phase === "running"
                    ? "bg-green-500/30 text-green-200 border-green-400/40"
                    : gameState.phase === "registration"
                      ? "bg-yellow-500/30 text-yellow-200 border-yellow-400/40"
                      : "bg-gray-500/30 text-gray-200 border-gray-400/40"
                }`}
              >
                {startCountdown > 0 ? startCountdown : gamePhaseDisplay}
              </div>

              <button
                onClick={handleSoundToggle}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isSoundOn
                    ? "bg-white/20 text-white"
                    : "bg-white/5 text-white/30"
                }`}
              >
                {isSoundOn ? "🔊" : "🔇"}
              </button>

              <button
                onClick={toggleAutoMark}
                className={`px-1 py-0.5 text-xl rounded-full font-bold transition-all ${
                  isAutoMarkOn
                    ? "bg-green-600/30 text-green-400"
                    : "bg-white/10 text-white/60"
                }`}
                title={isAutoMarkOn ? "Auto BINGO ON" : "Manual Mode"}
              >
                {isAutoMarkOn ? <LiaToggleOnSolid /> : <LiaToggleOffSolid />}
              </button>

              <button
                onClick={handleRefresh}
                className="w-7 h-7 rounded-full flex items-center justify-center text-base bg-white/20 text-white/70 font-bold"
              >
                <BiRefresh />
              </button>
            </div>
            <div className="text-right">
              <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                Game
              </div>
              <div className="text-white/70 text-[11px] font-bold font-mono">
                {currentGameId ? currentGameId.replace("LB", "#") : "---"}
              </div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="px-3 pb-1 flex-shrink-0">
          <div className="grid grid-cols-3 gap-1.5">
            <div className="bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/60 text-xs">PRIZE : </p>
              <p className="text-white font-bold text-xs">
                {currentPrizePool || 0}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/60 text-xs">Players : </p>
              <p className="text-white font-bold text-xs">
                {gameState.takenCards?.length || 0}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/60 text-xs">Stake : </p>
              <p className="text-white font-bold text-xs">{stake || 0}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/60 text-xs">Bonus : </p>
              <p className="text-white font-bold text-xs">
                {wallet.bonus?.toLocaleString() || 0}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/60 text-xs">Calls : </p>
              <p className="text-white font-bold text-xs">
                {calledNumbers.length}/75
              </p>
            </div>
          </div>
        </div>

        {/* Previously Called Numbers - Only show last 5 */}
        {!isWatchMode && calledNumbers.length > 0 && (
          <div className="px-3 pb-1 flex-shrink-0 my-1">
            <div className="flex justify-center gap-1.5 flex-wrap">
              {calledNumbers
                .slice(-5)
                .reverse()
                .map((n, i) => {
                  const isCurrent = n === currentNumber;
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
                  const colors = {
                    B: "bg-blue-500/30",
                    I: "bg-green-500/30",
                    N: "bg-purple-500/30",
                    G: "bg-red-500/30",
                    O: "bg-yellow-500/30",
                  };
                  return (
                    <div
                      key={`${n}-${i}`}
                      className={`rounded-full w-8 h-8 flex items-center justify-center text-[11px] font-extrabold font-mono border ${colors[letter]} ${isCurrent ? "ring-2 ring-yellow-400 scale-110" : ""}`}
                    >
                      {letter}
                      {n}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Number Board - Simplified for performance */}
        {!isWatchMode && (
          <div className="px-3 pb-1 flex-shrink-0">
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden max-h-[120px] overflow-y-auto">
              <div className="grid grid-cols-15 gap-0.5 p-1">
                {Array.from({ length: 75 }, (_, i) => i + 1).map((n) => {
                  const isCalled = calledNumbers.includes(n);
                  const isCurrent = currentNumber === n;
                  return (
                    <div
                      key={n}
                      className={`text-center text-[9px] py-0.5 font-bold rounded-sm ${isCurrent ? "bg-orange-500 text-white scale-105" : isCalled ? "bg-white/20 text-white" : "text-white/20"}`}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Cartellas Section */}
        <main className="flex-1 px-3 pb-1.5 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {yourCards.length > 0 ? (
              <div className="relative h-full">
                <Swiper
                  modules={[Navigation, Pagination]}
                  spaceBetween={16}
                  slidesPerView={1}
                  centeredSlides={true}
                  loop={true}
                  pagination={{ type: "fraction", clickable: true }}
                  navigation={{
                    prevEl: ".swiper-button-prev-custom",
                    nextEl: ".swiper-button-next-custom",
                  }}
                  onSwiper={(swiper) => {
                    swiperRef.current = swiper;
                  }}
                  className="w-full h-full"
                  style={{ paddingBottom: "40px" }}
                >
                  {yourCards.map(({ cardNumber, card }) => {
                    const markedNumbers = isAutoMarkOn
                      ? calledNumbers
                      : manuallyMarkedNumbers[cardNumber]
                        ? Array.from(manuallyMarkedNumbers[cardNumber])
                        : [];
                    const alreadyClaimed =
                      claimedCartellasRef.current.has(cardNumber);
                    const isClaiming = claimingStates[cardNumber];

                    return (
                      <SwiperSlide key={cardNumber}>
                        <div className="px-2 pb-8">
                          <div
                            className={`bg-white/5 backdrop-blur rounded-xl p-3 border ${alreadyClaimed ? "border-green-500/50 bg-green-500/10" : "border-white/10"}`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-white/70 text-sm font-bold">
                                Cartella #{cardNumber}
                              </span>
                              {alreadyClaimed && (
                                <span className="text-green-400 text-xs font-bold bg-green-500/20 px-2 py-0.5 rounded-full">
                                  WON ✓
                                </span>
                              )}
                              <button
                                onClick={() => handleCartellaBingo(cardNumber)}
                                disabled={
                                  isAutoMarkOn || isClaiming || alreadyClaimed
                                }
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                  alreadyClaimed
                                    ? "bg-gray-500/50 text-gray-300 cursor-not-allowed"
                                    : isAutoMarkOn
                                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white opacity-70 cursor-not-allowed"
                                      : "bg-gradient-to-r from-red-500 to-pink-500 text-white hover:scale-105"
                                }`}
                              >
                                {isClaiming
                                  ? "..."
                                  : alreadyClaimed
                                    ? "✓ WON"
                                    : isAutoMarkOn
                                      ? "🤖 AUTO"
                                      : "🎉 BINGO!"}
                              </button>
                            </div>

                            <MemoizedCartellaCard
                              id={cardNumber}
                              card={card}
                              called={markedNumbers}
                              isPreview={false}
                              showHeader={false}
                              isAutoMarkOn={isAutoMarkOn}
                              onNumberToggle={
                                !isAutoMarkOn
                                  ? (number) => {
                                      // Simple manual toggle
                                      setManuallyMarkedNumbers((prev) => {
                                        const marks = prev[cardNumber]
                                          ? new Set(prev[cardNumber])
                                          : new Set();
                                        if (marks.has(number))
                                          marks.delete(number);
                                        else marks.add(number);
                                        const newState = { ...prev };
                                        if (marks.size === 0)
                                          delete newState[cardNumber];
                                        else newState[cardNumber] = marks;
                                        return newState;
                                      });
                                    }
                                  : undefined
                              }
                              size="small"
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
                      className="swiper-button-prev-custom absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                      onClick={() => swiperRef.current?.slidePrev()}
                    >
                      <MdKeyboardArrowLeft size={20} />
                    </button>
                    <button
                      className="swiper-button-next-custom absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30"
                      onClick={() => swiperRef.current?.slideNext()}
                    >
                      <MdKeyboardArrowRight size={20} />
                    </button>
                  </>
                )}
              </div>
            ) : isWatchMode ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center px-6">
                  <div className="w-24 h-24 mx-auto rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-5xl"
                    >
                      👀
                    </motion.div>
                  </div>
                  <h3 className="text-white text-xl font-black mb-2">
                    Watch Mode
                  </h3>
                  <p className="text-white/40 text-sm mb-4">
                    Game currently in progress
                  </p>
                  <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
                    <p className="text-white/60 text-xs">
                      You will automatically join the next available game
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {/* Confetti Overlay - Simplified */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10px`,
                backgroundColor: [
                  "#ff6b6b",
                  "#ffd93d",
                  "#6bcb77",
                  "#4d96ff",
                  "#ff6b9d",
                ][Math.floor(Math.random() * 5)],
                animationDuration: `${0.8 + Math.random() * 0.5}s`,
                animationDelay: `${Math.random() * 0.5}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

