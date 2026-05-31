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

// ---------------------------------------------------------------------------
// Pure helpers – defined outside the component so they are never re-created
// ---------------------------------------------------------------------------

function checkBingoPattern(cartella, calledNumbers) {
  if (!cartella || !Array.isArray(cartella) || cartella.length !== 5)
    return false;
  if (!calledNumbers || !Array.isArray(calledNumbers)) return false;

  const calledSet = new Set(calledNumbers);

  // Rows
  for (let i = 0; i < 5; i++) {
    if (!cartella[i] || !Array.isArray(cartella[i])) continue;
    if (cartella[i].every((num) => num === 0 || calledSet.has(num)))
      return true;
  }

  // Columns
  for (let j = 0; j < 5; j++) {
    let colComplete = true;
    for (let i = 0; i < 5; i++) {
      const num = cartella[i][j];
      if (num !== 0 && !calledSet.has(num)) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) return true;
  }

  // Diagonal top-left → bottom-right
  if (
    Array.from({ length: 5 }, (_, i) => cartella[i][i]).every(
      (n) => n === 0 || calledSet.has(n),
    )
  )
    return true;

  // Diagonal top-right → bottom-left
  if (
    Array.from({ length: 5 }, (_, i) => cartella[i][4 - i]).every(
      (n) => n === 0 || calledSet.has(n),
    )
  )
    return true;

  // Corners
  const corners = [
    cartella[0][0],
    cartella[0][4],
    cartella[4][0],
    cartella[4][4],
  ];
  if (corners.every((n) => n === 0 || calledSet.has(n))) return true;

  return false;
}

function isLastCallPartOfWinningPattern(card, calledNumbers) {
  if (!card || !calledNumbers || calledNumbers.length === 0) return false;

  const lastCall = calledNumbers[calledNumbers.length - 1];
  const calledSet = new Set(calledNumbers);

  // Rows
  for (let row = 0; row < 5; row++) {
    if (!card[row]) continue;
    if (
      card[row].every((num) => num === 0 || calledSet.has(num)) &&
      card[row].includes(lastCall)
    )
      return true;
  }

  // Columns
  for (let col = 0; col < 5; col++) {
    let complete = true,
      hasLast = false;
    for (let row = 0; row < 5; row++) {
      const num = card[row][col];
      if (num !== 0 && !calledSet.has(num)) {
        complete = false;
        break;
      }
      if (num === lastCall) hasLast = true;
    }
    if (complete && hasLast) return true;
  }

  // Diagonals
  const checkDiag = (getIdx) => {
    let complete = true,
      hasLast = false;
    for (let i = 0; i < 5; i++) {
      const num = card[i][getIdx(i)];
      if (num !== 0 && !calledSet.has(num)) {
        complete = false;
        break;
      }
      if (num === lastCall) hasLast = true;
    }
    return complete && hasLast;
  };
  if (checkDiag((i) => i)) return true;
  if (checkDiag((i) => 4 - i)) return true;

  // Corners
  const corners = [card[0][0], card[0][4], card[4][0], card[4][4]];
  if (
    corners.every((n) => n === 0 || calledSet.has(n)) &&
    corners.includes(lastCall)
  )
    return true;

  return false;
}

// Pre-generate confetti so it's not recreated on every render
const CONFETTI_PIECES = Array.from({ length: 50 }, (_, i) => {
  const colors = [
    "#ff6b6b",
    "#ffd93d",
    "#6bcb77",
    "#4d96ff",
    "#ff6b9d",
    "#c44dff",
    "#00d2ff",
    "#ff9f43",
  ];
  return {
    id: i,
    left: `${Math.random() * 100}%`,
    top: `-${Math.random() * 20}px`,
    width: `${Math.random() * 8 + 6}px`,
    height: `${Math.random() * 8 + 6}px`,
    backgroundColor: colors[Math.floor(Math.random() * colors.length)],
    borderRadius: Math.random() > 0.5 ? "50%" : "2px",
    animationDelay: `${Math.random() * 0.5}s`,
    animationDuration: `${1 + Math.random()}s`,
  };
});

const CONFETTI_EMOJIS = ["🎉", "🎊", "✨", "🌟", "💫", "🏆", "⭐", "🎯"];

// Stable row definitions for the bingo board
const BINGO_ROWS = [
  {
    letter: "B",
    color: "bg-blue-600/70 text-blue-100",
    nums: Array.from({ length: 15 }, (_, i) => i + 1),
  },
  {
    letter: "I",
    color: "bg-green-600/70 text-green-100",
    nums: Array.from({ length: 15 }, (_, i) => i + 16),
  },
  {
    letter: "N",
    color: "bg-purple-600/70 text-purple-100",
    nums: Array.from({ length: 15 }, (_, i) => i + 31),
  },
  {
    letter: "G",
    color: "bg-red-600/70 text-red-100",
    nums: Array.from({ length: 15 }, (_, i) => i + 46),
  },
  {
    letter: "O",
    color: "bg-yellow-600/70 text-yellow-100",
    nums: Array.from({ length: 15 }, (_, i) => i + 61),
  },
];

// ---------------------------------------------------------------------------
// Sub-components to reduce re-render surface
// ---------------------------------------------------------------------------

const BingoBoard = React.memo(function BingoBoard({
  calledNumbers,
  currentNumber,
}) {
  const calledSet = useMemo(() => new Set(calledNumbers), [calledNumbers]);
  return (
    <div className="px-3 pb-1 flex-shrink-0">
      <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full border-collapse">
          <tbody>
            {BINGO_ROWS.map(({ letter, color, nums }) => (
              <tr key={letter}>
                <td
                  className={`text-center text-[11px] font-black py-0.5 w-[8%] ${color}`}
                >
                  {letter}
                </td>
                {nums.map((n) => {
                  const isCurrent = currentNumber === n;
                  const isCalled = calledSet.has(n);
                  return (
                    <td
                      key={n}
                      className={`text-center text-[10px] py-0.5 font-bold transition-all duration-200 ${
                        isCurrent
                          ? "bg-orange-500 text-white font-extrabold rounded-sm shadow-lg shadow-orange-500/50 scale-110"
                          : isCalled
                            ? "bg-white/20 text-white font-extrabold"
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
    </div>
  );
});

// Letter lookup is O(1) via Map instead of conditional chain
const NUMBER_LETTER_MAP = new Map([
  ...Array.from({ length: 15 }, (_, i) => [i + 1, "B"]),
  ...Array.from({ length: 15 }, (_, i) => [i + 16, "I"]),
  ...Array.from({ length: 15 }, (_, i) => [i + 31, "N"]),
  ...Array.from({ length: 15 }, (_, i) => [i + 46, "G"]),
  ...Array.from({ length: 15 }, (_, i) => [i + 61, "O"]),
]);

const LETTER_COLORS = {
  B: "bg-blue-500/30 text-blue-200 border-blue-400/40",
  I: "bg-green-500/30 text-green-200 border-green-400/40",
  N: "bg-purple-500/30 text-purple-200 border-purple-400/40",
  G: "bg-red-500/30 text-red-200 border-red-400/40",
  O: "bg-yellow-500/30 text-yellow-200 border-yellow-400/40",
};

const RecentNumbers = React.memo(function RecentNumbers({
  calledNumbers,
  currentNumber,
}) {
  const lastFive = useMemo(
    () => [...calledNumbers].slice(-5).reverse(),
    [calledNumbers],
  );

  return (
    <div className="px-3 pb-1 flex-shrink-0 my-2">
      <div className="flex justify-center gap-1.5 flex-wrap relative">
        <AnimatePresence mode="popLayout">
          {lastFive.map((n, i) => {
            const isCurrent = n === currentNumber;
            const letter = NUMBER_LETTER_MAP.get(n) ?? "B";
            return (
              <motion.div
                key={`${n}-${calledNumbers.length - i}`}
                layout
                initial={
                  isCurrent
                    ? { scale: 0, rotate: -180 }
                    : { opacity: 0, scale: 0.3, y: 20 }
                }
                animate={{
                  opacity: 1,
                  scale: isCurrent ? [0, 1.2, 1] : 1,
                  y: 0,
                  rotate: 0,
                }}
                exit={{ opacity: 0, scale: 0.3, y: -20 }}
                transition={{
                  type: "spring",
                  damping: isCurrent ? 10 : 15,
                  stiffness: isCurrent ? 200 : 250,
                  delay: isCurrent ? 0 : i * 0.05,
                }}
                whileHover={{ scale: 1.1 }}
                className={`rounded-full w-8 h-8 flex items-center justify-center text-[11px] font-extrabold font-mono border ${LETTER_COLORS[letter]} ${
                  isCurrent
                    ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-purple-900 scale-110 bg-opacity-80 shadow-2xl shadow-yellow-500/50"
                    : i === 0 && !isCurrent
                      ? "ring-1 ring-blue-400/50 ring-offset-1 ring-offset-[var(--cardbackground)]"
                      : ""
                }`}
                style={{
                  boxShadow: isCurrent
                    ? "0 0 20px rgba(234, 179, 8, 0.6)"
                    : undefined,
                }}
              >
                {isCurrent && (
                  <motion.div
                    className="absolute -top-2 -left-2"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <div className="bg-red-500 text-white text-[8px] font-bold p-1 rounded-full animate-pulse">
                      <CgLivePhoto className="inline-block w-3 h-3" />
                    </div>
                  </motion.div>
                )}
                <span className={isCurrent ? "text-white drop-shadow-lg" : ""}>
                  {letter}
                  {n}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function GameLayout({ stake, onNavigate }) {
  const { sessionId } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [showTimeout, setShowTimeout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertBanners, setAlertBanners] = useState([]);
  const alertTimersRef = useRef(new Map());

  const { connected, gameState, claimBingo, connectToStake, ws } =
    useWebSocket();

  // ---------------------------------------------------------------------------
  // Derived state – memoized so downstream hooks/renders don't over-compute
  // ---------------------------------------------------------------------------
  const calledNumbers = useMemo(
    () =>
      Array.isArray(gameState.calledNumbers) ? gameState.calledNumbers : [],
    [gameState.calledNumbers],
  );
  const currentNumber = gameState.currentNumber;
  const currentGameId = gameState.gameId;
  const currentPrizePool = gameState.prizePool || 0;
  const yourCards = useMemo(
    () => (Array.isArray(gameState.yourCards) ? gameState.yourCards : []),
    [gameState.yourCards],
  );

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------
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
  // Single source of truth for missed winning patterns (removed duplicate)
  const [missedPatterns, setMissedPatterns] = useState({});
  const [wallet, setWallet] = useState({ main: 0, bonus: 0 });
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const confettiRef = useRef(null);
  const swiperRef = useRef(null);
  const claimedCartellasRef = useRef(new Set());
  const lastGameIdRef = useRef(null);
  const missedPatternsPersistentRef = useRef({});
  const audioInitializedRef = useRef(false);
  const pendingBingoClaimsRef = useRef([]);
  const isProcessingQueueRef = useRef(false);
  const offlineWinDetectedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  }, []);

  // ---------------------------------------------------------------------------
  // Process pending offline bingo claims
  // ---------------------------------------------------------------------------
  const processPendingClaims = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    if (pendingBingoClaimsRef.current.length === 0) return;
    if (!navigator.onLine) return;

    isProcessingQueueRef.current = true;

    while (pendingBingoClaimsRef.current.length > 0) {
      const claim = pendingBingoClaimsRef.current[0];
      const card = yourCards.find(
        (c) => c.cardNumber === claim.cardNumber,
      )?.card;

      if (card && checkBingoPattern(card, calledNumbers)) {
        const result = claimBingo({ cardNumber: claim.cardNumber });
        if (result) {
          pendingBingoClaimsRef.current.shift();
          showSuccess(
            `🎉 Auto-BINGO claimed for Cartella #${claim.cardNumber}!`,
          );
          claimedCartellasRef.current.add(claim.cardNumber);
        } else {
          break;
        }
      } else if (gameState.phase === "announce") {
        const winners = gameState.winners || [];
        const isWinner = winners.some(
          (w) => w.cartelaNumber === claim.cardNumber,
        );
        if (isWinner) {
          showWarning(
            `Your win for Cartella #${claim.cardNumber} has been recorded. Please contact support if not credited.`,
          );
        }
        pendingBingoClaimsRef.current.shift();
      } else {
        pendingBingoClaimsRef.current.shift();
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    isProcessingQueueRef.current = false;
  }, [
    yourCards,
    calledNumbers,
    claimBingo,
    showSuccess,
    showWarning,
    gameState.winners,
    gameState.phase,
  ]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Clear manual marks when auto-mark is enabled
  useEffect(() => {
    if (isAutoMarkOn && Object.keys(manuallyMarkedNumbers).length > 0) {
      setManuallyMarkedNumbers({});
    }
  }, [isAutoMarkOn]); // intentionally omit manuallyMarkedNumbers to avoid loop

  // Connect on mount / stake change
  useEffect(() => {
    if (stake && sessionId) connectToStake(stake);
  }, [stake, sessionId, connectToStake]);

  // Reconnect on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (
        document.visibilityState === "visible" &&
        stake &&
        sessionId &&
        !connected
      ) {
        setTimeout(() => connectToStake(stake), 100);
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [stake, sessionId, connected, connectToStake]);

  // Init audio on first interaction
  useEffect(() => {
    const init = async () => {
      if (audioInitializedRef.current) return;
      audioInitializedRef.current = true;
      await initAudio().catch(() => {});
      await preloadNumberSounds().catch(() => {});
      document.removeEventListener("click", init);
      document.removeEventListener("touchstart", init);
    };
    document.addEventListener("click", init);
    document.addEventListener("touchstart", init);
    return () => {
      document.removeEventListener("click", init);
      document.removeEventListener("touchstart", init);
    };
  }, []);

  // Play number sound
  useEffect(() => {
    if (
      !isSoundOn ||
      !currentNumber ||
      startCountdown > 0 ||
      gameState.phase !== "running"
    )
      return;
    playNumberSound(currentNumber).catch(() => {});
  }, [currentNumber, isSoundOn, startCountdown, gameState.phase]);

  // Reset per-game state when game ID changes
  useEffect(() => {
    if (currentGameId !== lastGameIdRef.current) {
      claimedCartellasRef.current.clear();
      lastGameIdRef.current = currentGameId;
      setClaimingStates({});
      setMissedPatterns({});
      missedPatternsPersistentRef.current = {};
    }
  }, [currentGameId]);

  // Countdown logic
  useEffect(() => {
    if (gameState.phase !== "running") {
      setStartCountdown(0);
      return;
    }
    if (calledNumbers.length === 0) setStartCountdown(3);
  }, [gameState.phase, calledNumbers.length, currentGameId]);

  useEffect(() => {
    if (startCountdown <= 0) return;
    const t = setTimeout(
      () => setStartCountdown((prev) => Math.max(0, prev - 1)),
      1000,
    );
    return () => clearTimeout(t);
  }, [startCountdown]);

  // Missed winning pattern tracking (consolidated – was duplicated before)
  useEffect(() => {
    if (gameState.phase !== "running") {
      setMissedPatterns({});
      return;
    }
    if (yourCards.length === 0 || calledNumbers.length === 0) return;

    setMissedPatterns((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const { cardNumber, card } of yourCards) {
        if (claimedCartellasRef.current.has(cardNumber)) {
          if (next[cardNumber]) {
            delete next[cardNumber];
            delete missedPatternsPersistentRef.current[cardNumber];
            changed = true;
          }
          continue;
        }

        const hasWinNow = checkBingoPattern(card, calledNumbers);
        const previousCalled = calledNumbers.slice(0, -1);
        const hadWinBefore =
          previousCalled.length > 0
            ? checkBingoPattern(card, previousCalled)
            : false;

        if (hadWinBefore && !hasWinNow && !next[cardNumber]) {
          next[cardNumber] = previousCalled;
          missedPatternsPersistentRef.current[cardNumber] = previousCalled;
          changed = true;
        }

        if (hasWinNow && next[cardNumber]) {
          delete next[cardNumber];
          delete missedPatternsPersistentRef.current[cardNumber];
          changed = true;
        }
      }

      return changed ? next : prev; // avoid unnecessary re-render
    });
  }, [calledNumbers, gameState.phase, yourCards]);

  // AUTO-BINGO
  useEffect(() => {
    if (
      gameState.phase !== "running" ||
      !isAutoMarkOn ||
      yourCards.length === 0
    )
      return;

    for (const { cardNumber, card } of yourCards) {
      if (claimedCartellasRef.current.has(cardNumber)) continue;
      if (!checkBingoPattern(card, calledNumbers)) continue;
      if (!isLastCallPartOfWinningPattern(card, calledNumbers)) continue;
      if (
        pendingBingoClaimsRef.current.some((c) => c.cardNumber === cardNumber)
      )
        continue;

      claimedCartellasRef.current.add(cardNumber);
      triggerConfetti();

      if (!navigator.onLine) {
        pendingBingoClaimsRef.current.push({
          cardNumber,
          timestamp: Date.now(),
          calledNumbersAtWin: [...calledNumbers],
        });
        showWarning(
          `You're offline! Your win for Cartella #${cardNumber} will be claimed when connection returns.`,
        );
        offlineWinDetectedRef.current = true;
        continue;
      }

      const result = claimBingo({ cardNumber });
      if (result) {
        showSuccess(`🎉 Auto-BINGO! Cartella #${cardNumber} won!`);
        setMissedPatterns((prev) => {
          if (!prev[cardNumber]) return prev;
          const next = { ...prev };
          delete next[cardNumber];
          delete missedPatternsPersistentRef.current[cardNumber];
          return next;
        });
      } else {
        pendingBingoClaimsRef.current.push({
          cardNumber,
          timestamp: Date.now(),
          calledNumbersAtWin: [...calledNumbers],
        });
        showWarning(
          `Network issue! Your win for Cartella #${cardNumber} will be claimed when connection returns.`,
        );
        processPendingClaims();
      }
      break;
    }
  }, [
    calledNumbers,
    gameState.phase,
    isAutoMarkOn,
    yourCards,
    claimBingo,
    showSuccess,
    showWarning,
    processPendingClaims,
    triggerConfetti,
  ]);

  // WebSocket close handler – reload if online + game active
  useEffect(() => {
    if (!ws) return;
    const handleClose = () => {
      if (currentGameId && navigator.onLine) {
        if (stake) {
          sessionStorage.setItem("reconnect_stake", stake);
          sessionStorage.setItem("reconnect_timestamp", Date.now().toString());
        }
        showWarning("Connection lost! Refreshing game...");
        setTimeout(() => window.location.reload(), 2000);
      }
    };
    ws.addEventListener("close", handleClose);
    return () => ws.removeEventListener("close", handleClose);
  }, [ws, currentGameId, stake, showWarning]);

  // Network recovery – periodic check + reload (consolidated into one effect)
  useEffect(() => {
    let reloadTimer = null;
    let countdownInterval = null;
    let periodicCheck = null;

    const cancelReload = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
      }
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    };

    const triggerReload = () => {
      if (reloadTimer) return;
      if (stake) {
        sessionStorage.setItem("reconnect_stake", stake);
        sessionStorage.setItem("reconnect_timestamp", Date.now().toString());
      }
      showWarning("Network recovered! Refreshing game in 3 seconds...");
      let countdown = 3;
      countdownInterval = setInterval(() => {
        showWarning(`Refreshing in ${countdown--}...`);
        if (countdown < 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
        }
      }, 1000);
      reloadTimer = setTimeout(() => window.location.reload(), 3000);
    };

    const checkConnection = () => {
      if (navigator.onLine && connected) {
        cancelReload();
        return;
      }
      if (
        navigator.onLine &&
        !connected &&
        currentGameId &&
        !isRefreshing &&
        !reloadTimer
      ) {
        triggerReload();
      }
    };

    const handleOnline = () => {
      setIsOffline(false);
      setTimeout(checkConnection, 2000);
      if (offlineWinDetectedRef.current) {
        showSuccess("Network restored! Claiming your wins...");
        offlineWinDetectedRef.current = false;
      }
      processPendingClaims();
    };
    const handleOffline = () => {
      setIsOffline(true);
      cancelReload();
      showWarning("Network lost! Will refresh when connection returns.");
      if (pendingBingoClaimsRef.current.length > 0)
        showWarning(
          "Network disconnected! Your win will be claimed when connection returns.",
        );
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    periodicCheck = setInterval(() => {
      checkConnection();
      if (pendingBingoClaimsRef.current.length > 0 && navigator.onLine)
        processPendingClaims();
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(periodicCheck);
      cancelReload();
    };
  }, [
    connected,
    currentGameId,
    isRefreshing,
    stake,
    showWarning,
    showSuccess,
    processPendingClaims,
  ]);

  // Navigate to winner screen
  useEffect(() => {
    if (gameState.phase === "announce" && !isRefreshing) {
      pendingBingoClaimsRef.current = [];
      offlineWinDetectedRef.current = false;
      onNavigate?.("winner");
    }
  }, [gameState.phase, onNavigate, isRefreshing]);

  // Timeout if no game ID
  useEffect(() => {
    if (!currentGameId) {
      const t = setTimeout(() => setShowTimeout(true), 5000);
      return () => clearTimeout(t);
    }
    setShowTimeout(false);
  }, [currentGameId]);

  // Reset on registration phase
  useEffect(() => {
    if (gameState.phase !== "registration") return;
    setShowTimeout(false);
    setIsRefreshing(false);
    claimedCartellasRef.current.clear();
    setClaimingStates({});
    setMissedPatterns({});
    missedPatternsPersistentRef.current = {};
    pendingBingoClaimsRef.current = [];
    offlineWinDetectedRef.current = false;
  }, [gameState.phase]);

  // Bingo rejected event
  useEffect(() => {
    const handler = (event) => {
      const reason = event?.detail?.reason || "invalid_claim";
      const cardNumber = event?.detail?.cardNumber;
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
    window.addEventListener("bingoRejected", handler);
    return () => window.removeEventListener("bingoRejected", handler);
  }, [calledNumbers]);

  // Alert banner auto-dismiss
  useEffect(() => {
    const active = new Set(alertBanners);
    alertTimersRef.current.forEach((timer, msg) => {
      if (!active.has(msg)) {
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

  useEffect(
    () => () => {
      alertTimersRef.current.forEach(clearTimeout);
      alertTimersRef.current.clear();
    },
    [],
  );

  // Wallet update
  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.type !== "wallet_update") return;
      const { main, bonus } = event.detail.payload;
      setWallet((prev) => ({
        main: main !== undefined ? main : prev.main,
        bonus: bonus !== undefined ? bonus : prev.bonus,
      }));
    };
    window.addEventListener("walletUpdate", handler);
    return () => window.removeEventListener("walletUpdate", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  const handleNumberToggle = useCallback(
    (cardNumber, number) => {
      if (isAutoMarkOn) return;
      setManuallyMarkedNumbers((prev) => {
        const existing = prev[cardNumber] ?? new Set();
        const newCardMarks = new Set(existing);
        newCardMarks.has(number)
          ? newCardMarks.delete(number)
          : newCardMarks.add(number);
        return { ...prev, [cardNumber]: newCardMarks };
      });
    },
    [isAutoMarkOn],
  );

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
      const card = yourCards.find((c) => c.cardNumber === cardNumber)?.card;
      if (!card) {
        showError(`Cartella #${cardNumber} not found`);
        return;
      }
      if (!isAutoMarkOn && !checkBingoPattern(card, calledNumbers)) {
        showError(`No winning pattern on Cartella #${cardNumber}`);
        return;
      }
      if (claimingStates[cardNumber]) return;

      try {
        setClaimingStates((prev) => ({ ...prev, [cardNumber]: true }));
        triggerConfetti();
        const result = claimBingo({ cardNumber });
        if (!result) {
          showError(`Failed to claim BINGO for Cartella #${cardNumber}`);
        } else {
          showSuccess(`🎉 BINGO claimed for Cartella #${cardNumber}!`);
          claimedCartellasRef.current.add(cardNumber);
          setMissedPatterns((prev) => {
            if (!prev[cardNumber]) return prev;
            const next = { ...prev };
            delete next[cardNumber];
            return next;
          });
          delete missedPatternsPersistentRef.current[cardNumber];
        }
      } catch {
        showError(`Failed to claim BINGO for Cartella #${cardNumber}`);
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
      isAutoMarkOn,
      showError,
      showSuccess,
      triggerConfetti,
    ],
  );

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      if (stake && sessionId) {
        connectToStake(stake);
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
      showError("Failed to refresh game state.");
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, stake, sessionId, connectToStake, showError]);

  const handleSoundToggle = useCallback(() => {
    const newState = !isSoundOn;
    setIsSoundOn(newState);
    localStorage.setItem("lekulu_sound_enabled", String(newState));
    if (newState && !audioInitializedRef.current) {
      audioInitializedRef.current = true;
      initAudio().catch(() => {});
      resumeAudio().catch(() => {});
    }
  }, [isSoundOn]);

  const handleAutoMarkToggle = useCallback(() => {
    setIsAutoMarkOn((prev) => {
      const next = !prev;
      if (next) {
        // switching ON: pre-fill manually marked numbers from called list
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
      return next;
    });
  }, [yourCards, calledNumbers]);

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------
  const gamePhaseDisplay =
    gameState.phase === "running"
      ? "LIVE"
      : gameState.phase === "registration"
        ? "REG"
        : "WAIT";
  const isWatchMode = yourCards.length === 0;

  // ---------------------------------------------------------------------------
  // Early returns
  // ---------------------------------------------------------------------------
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
          {showTimeout && (
            <button
              onClick={() => onNavigate?.("cartela-selection")}
              className="px-6 py-3 bg-pink-600 text-white rounded-lg font-bold"
            >
              Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-1 text-xs font-medium">
          ⚠️ You're offline - wins will be stored and claimed when online
        </div>
      )}

      {pendingBingoClaimsRef.current.length > 0 && !isOffline && (
        <div className="fixed top-12 left-0 right-0 z-50 bg-blue-500 text-white text-center py-1 text-xs font-medium">
          🔄 Processing {pendingBingoClaimsRef.current.length} pending win(s)...
        </div>
      )}

      {alertBanners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
          {alertBanners.map((msg, i) => (
            <div
              key={i}
              className="alert-banner-appeal animate-slide-in"
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isSoundOn ? "bg-white/20 text-white hover:bg-white/30" : "bg-white/5 text-white/30 hover:bg-white/10"}`}
                aria-label={isSoundOn ? "Mute" : "Unmute"}
              >
                {isSoundOn ? "🔊" : "🔇"}
              </button>
              <button
                onClick={handleAutoMarkToggle}
                className={`px-1 py-0.5 text-xl rounded-full font-bold ${isAutoMarkOn ? "text-green-600 bg-green-600/20" : "text-white/70 bg-white/20"}`}
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

        {/* Stats bar */}
        <div className="px-3 pb-1 flex-shrink-0">
          <div className="grid grid-cols-3 gap-1.5">
            {[
              ["DERASH", currentPrizePool || 0],
              ["Players", gameState.takenCards?.length || 0],
              ["Stake", stake || 0],
              ["Bonus", wallet.bonus?.toLocaleString() || 0],
              ["Calls", `${calledNumbers.length}/75`],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-center gap-1 bg-white/5 rounded-lg p-1 text-center border border-white/10"
              >
                <p className="text-white/60 text-xs">{label} : </p>
                <p className="text-white font-bold text-xs">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent numbers + bingo board */}
        {!isWatchMode && (
          <>
            {calledNumbers.length > 0 ? (
              <RecentNumbers
                calledNumbers={calledNumbers}
                currentNumber={currentNumber}
              />
            ) : (
              <p className="text-white text-[11px] uppercase tracking-widest font-bold mb-1 text-center">
                Starts in {startCountdown > 0 ? startCountdown : "0"} secs
              </p>
            )}
            <BingoBoard
              calledNumbers={calledNumbers}
              currentNumber={currentNumber}
            />
          </>
        )}

        {/* Cards / watch mode */}
        <main className="flex-1 px-3 pb-1.5 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1">
            {yourCards.length > 0 ? (
              <div className="relative h-full">
                <Swiper
                  modules={[Navigation, Pagination, Autoplay]}
                  spaceBetween={16}
                  slidesPerView={1}
                  centeredSlides
                  loop
                  autoplay={false}
                  pagination={{
                    type: "fraction",
                    clickable: true,
                    renderFraction: (currentClass, totalClass) =>
                      `<span class="${currentClass}" style="color:white;font-weight:bold;font-size:14px;"></span><span style="color:white;opacity:0.5;margin:0 4px;">/</span><span class="${totalClass}" style="color:white;opacity:0.7;font-size:12px;"></span>`,
                  }}
                  navigation={{
                    prevEl: ".swiper-button-prev-custom",
                    nextEl: ".swiper-button-next-custom",
                  }}
                  onSwiper={(swiper) => {
                    swiperRef.current = swiper;
                  }}
                  className="w-full h-full"
                  style={{ paddingBottom: "20px" }}
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
                    const hasMissedPattern = !!missedPatterns[cardNumber];

                    return (
                      <SwiperSlide key={cardNumber}>
                        <div className="px-2 pb-8">
                          <div
                            className={`bg-white/5 backdrop-blur rounded-xl p-3 border ${
                              hasMissedPattern &&
                              !alreadyClaimed &&
                              !isAutoMarkOn
                                ? "border-red-500/50 bg-red-500/10"
                                : hasWinningPattern &&
                                    !alreadyClaimed &&
                                    !isAutoMarkOn
                                  ? "border-green-500/50 bg-green-500/10"
                                  : "border-white/10"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white/70 text-sm font-bold">
                                  Cartella #{cardNumber}
                                </span>
                                {alreadyClaimed && (
                                  <span className="text-green-400 text-xs font-bold bg-green-500/20 px-2 py-0.5 rounded-full">
                                    WON ✓
                                  </span>
                                )}
                                {!isAutoMarkOn && hasMissedPattern && (
                                  <span className="text-red-400 text-[9px] font-bold bg-red-500/20 px-1.5 py-0.5 rounded-full">
                                    MISSED
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleCartellaBingo(cardNumber)}
                                disabled={isAutoMarkOn || isClaiming}
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
                                      ? "🤖 AUTO BINGO"
                                      : "🎉 BINGO!"}
                              </button>
                            </div>
                            <CartellaCard
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
                                missedPatterns[cardNumber] || null
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
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-5xl"
                      >
                        👀
                      </motion.div>
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
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
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
                        {gameState.takenCards?.length || 0}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4 mb-6 max-w-[280px]">
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
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-white/20"
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{
                          duration: 1.2,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Confetti */}
          {showConfetti && (
            <div className="confetti-container" ref={confettiRef}>
              {CONFETTI_PIECES.map(({ id, ...style }) => (
                <div key={id} className="confetti-piece" style={style} />
              ))}
              {CONFETTI_EMOJIS.map((emoji, i) => (
                <div
                  key={`star-${i}`}
                  className="star-particle"
                  style={{
                    left: `${10 + Math.random() * 80}%`,
                    top: `${20 + Math.random() * 40}%`,
                    animationDelay: `${i * 0.1}s`,
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
