import React, { useEffect, useState, useRef, useCallback } from "react";
import CartellaCard from "../components/CartellaCard";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../lib/auth/AuthProvider";
import { useToast } from "../contexts/ToastContext";
import {
  playNumberSound,
  preloadNumberSounds,
} from "../lib/audio/numberSounds";
import "../styles/bingo-balls.css";
import "../styles/action-buttons.css";
import { motion, AnimatePresence } from "framer-motion";

export default function GameLayout({ stake, onNavigate }) {
  const { sessionId } = useAuth();
  const { showSuccess, showError } = useToast();
  const [showTimeout, setShowTimeout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertBanners, setAlertBanners] = useState([]);
  const alertTimersRef = useRef(new Map());

  const checkBingoPattern = (cartella, calledNumbers) => {
    if (!cartella || !Array.isArray(cartella) || !Array.isArray(calledNumbers))
      return false;
    for (let i = 0; i < 5; i++) {
      if (cartella[i].every((num) => num === 0 || calledNumbers.includes(num)))
        return true;
    }
    for (let j = 0; j < 5; j++) {
      if (
        cartella.every((row) => row[j] === 0 || calledNumbers.includes(row[j]))
      )
        return true;
    }
    if (
      cartella.every((row, i) => row[i] === 0 || calledNumbers.includes(row[i]))
    )
      return true;
    if (
      cartella.every(
        (row, i) => row[4 - i] === 0 || calledNumbers.includes(row[4 - i]),
      )
    )
      return true;
    const topLeft = cartella[0][0],
      topRight = cartella[0][4],
      bottomLeft = cartella[4][0],
      bottomRight = cartella[4][4];
    if (
      (topLeft === 0 || calledNumbers.includes(topLeft)) &&
      (topRight === 0 || calledNumbers.includes(topRight)) &&
      (bottomLeft === 0 || calledNumbers.includes(bottomLeft)) &&
      (bottomRight === 0 || calledNumbers.includes(bottomRight))
    )
      return true;
    return false;
  };

  const { connected, gameState, claimBingo, connectToStake } = useWebSocket();
  const currentPlayersCount = gameState.playersCount || 0;
  const currentPrizePool = gameState.prizePool || 0;
  const calledNumbers = gameState.calledNumbers || [];
  const currentNumber = gameState.currentNumber;
  const currentGameId = gameState.gameId;
  const yourCards = Array.isArray(gameState.yourCards)
    ? gameState.yourCards
    : [];

  const [isSoundOn, setIsSoundOn] = useState(false);
  const [isAutoMarkOn, setIsAutoMarkOn] = useState(true);
  const [manuallyMarkedNumbers, setManuallyMarkedNumbers] = useState({});
  const [isManualClaiming, setIsManualClaiming] = useState(false);
  const [startCountdown, setStartCountdown] = useState(0);

  useEffect(() => {
    if (isAutoMarkOn && Object.keys(manuallyMarkedNumbers).length > 0)
      setManuallyMarkedNumbers({});
  }, [isAutoMarkOn]);
  const claimedBingoRef = useRef(false);
  const lastGameIdRef = useRef(null);
  const [missedClaimWindow, setMissedClaimWindow] = useState(false);
  const [missedPatternCalledSnapshot, setMissedPatternCalledSnapshot] =
    useState(null);
  const calledLenEvalRef = useRef(-1);

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

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        preloadNumberSounds();
      } catch {}
    }, 1000);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    if (isSoundOn && typeof currentNumber === "number")
      playNumberSound(currentNumber).catch(() => {});
  }, [currentNumber, isSoundOn]);

  useEffect(() => {
    if (currentGameId !== lastGameIdRef.current) {
      claimedBingoRef.current = false;
      lastGameIdRef.current = currentGameId;
      calledLenEvalRef.current = -1;
      setMissedClaimWindow(false);
      setMissedPatternCalledSnapshot(null);
    }
  }, [currentGameId]);

  useEffect(() => {
    if (gameState.phase !== "running" || yourCards.length !== 1) {
      setMissedClaimWindow(false);
      setMissedPatternCalledSnapshot(null);
      return;
    }
    const card = yourCards[0]?.card;
    if (!card) return;
    const len = calledNumbers.length;
    if (calledLenEvalRef.current < 0) {
      calledLenEvalRef.current = len;
      return;
    }
    if (len > calledLenEvalRef.current) {
      for (let i = calledLenEvalRef.current + 1; i <= len; i++) {
        if (
          checkBingoPattern(card, calledNumbers.slice(0, i - 1)) &&
          !claimedBingoRef.current
        ) {
          setMissedClaimWindow(true);
          setMissedPatternCalledSnapshot([...calledNumbers.slice(0, i - 1)]);
          break;
        }
      }
    }
    calledLenEvalRef.current = len;
  }, [calledNumbers, gameState.phase, yourCards, currentGameId]);

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

  const handleManualBingo = useCallback(() => {
    if (!connected || gameState.phase !== "running" || !currentGameId) return;
    if (claimedBingoRef.current || isManualClaiming) return;
    try {
      setIsManualClaiming(true);
      claimedBingoRef.current = true;
      let payload = {};
      if (yourCards.length === 1) {
        const { cardNumber } = yourCards[0] || {};
        payload = { cardNumber };
      }
      const result = claimBingo(payload);
      if (!result) {
        claimedBingoRef.current = false;
        showError("Failed to send BINGO claim.");
      } else showSuccess("BINGO claim sent!");
    } catch {
      claimedBingoRef.current = false;
      showError("Failed to send BINGO claim.");
    } finally {
      setIsManualClaiming(false);
    }
  }, [
    claimBingo,
    connected,
    currentGameId,
    gameState.phase,
    isManualClaiming,
    showError,
    showSuccess,
    yourCards,
  ]);

  useEffect(() => {
    if (
      gameState.phase !== "running" ||
      !isAutoMarkOn ||
      yourCards.length !== 1 ||
      claimedBingoRef.current
    )
      return;
    const card = yourCards[0]?.card;
    if (!card || calledNumbers.length === 0) return;
    if (checkBingoPattern(card, calledNumbers)) handleManualBingo();
  }, [calledNumbers, gameState.phase, isAutoMarkOn, yourCards]);

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
    try {
      setIsRefreshing(true);
      await new Promise((r) => setTimeout(r, 100));
      if (stake && sessionId) {
        connectToStake(stake);
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch {
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (gameState.phase === "announce" && !isRefreshing) {
      const winners = gameState.winners || [];
      if (winners.length > 0) {
        const names = winners.map((w) => w.name || "Player").join(", ");
        showSuccess(
          winners.some((w) => w.userId === sessionId)
            ? "🎉 You won!"
            : `🏆 Winner: ${names}`,
        );
      }
      onNavigate?.("winner");
    }
  }, [
    gameState.phase,
    gameState.winners,
    sessionId,
    onNavigate,
    isRefreshing,
    showSuccess,
  ]);

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
      claimedBingoRef.current = false;
      calledLenEvalRef.current = -1;
      setMissedClaimWindow(false);
      setMissedPatternCalledSnapshot(null);
    }
  }, [gameState.phase]);

  useEffect(() => {
    const h = (event) => {
      claimedBingoRef.current = false;
      const reason = event?.detail?.reason || "invalid_claim";
      if (reason === "invalid_claim") {
        setManuallyMarkedNumbers({});
        setAlertBanners((prev) => [...prev, "Invalid BINGO! Marks cleared."]);
      } else if (reason === "stale_claim") {
        setAlertBanners((prev) => [
          ...prev,
          "Pattern passed. Wait for next call.",
        ]);
      }
    };
    window.addEventListener("bingoRejected", h);
    return () => window.removeEventListener("bingoRejected", h);
  }, []);

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

  const gamePhaseDisplay =
    gameState.phase === "running"
      ? "LIVE"
      : gameState.phase === "registration"
        ? "REG"
        : "WAIT";
  const hasSingleCartela = yourCards.length === 1;
  const isWatchMode = yourCards.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
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
                onClick={() => setIsSoundOn(!isSoundOn)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isSoundOn ? "bg-white/20 text-white" : "bg-white/5 text-white/30"}`}
              >
                {isSoundOn ? "🔊" : "🔇"}
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isAutoMarkOn ? "bg-green-500/30 text-green-200" : "bg-white/5 text-white/30"}`}
              >
                {isAutoMarkOn ? "🟢" : "✋"}
              </button>
              <button
                onClick={handleRefresh}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-white/5 text-white/50 hover:bg-white/15 font-bold"
              >
                🔄
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
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-amber-500/15 rounded-lg p-1.5 text-center border border-amber-500/20">
              <div className="text-amber-300/60 text-[9px] uppercase tracking-widest font-bold">
                Derash
              </div>
              <div className="text-amber-200 font-black text-sm">
                {currentPrizePool || 0}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-1.5 text-center border border-white/10">
              <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                Players
              </div>
              <div className="text-blue-300 font-extrabold text-sm">
                {currentPlayersCount || 0}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-1.5 text-center border border-white/10">
              <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                Stake
              </div>
              <div className="text-green-300 font-extrabold text-sm">
                {stake || 0}
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-1.5 text-center border border-white/10">
              <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                Calls
              </div>
              <div className="text-pink-300 font-extrabold text-sm">
                {calledNumbers.length}/75
              </div>
            </div>
          </div>
        </div>

        {/* Current Call - Big */}
        {/* <div className="px-3 pb-1 flex-shrink-0 flex justify-center">
          {currentNumber ? (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl px-5 py-2 shadow-lg shadow-orange-500/40 animate-pulse">
              <div className="text-white/90 text-[10px] uppercase tracking-widest text-center font-bold">
                Current Call
              </div>
              <div className="text-white font-black text-2xl text-center drop-shadow-lg">
                {currentNumber <= 15
                  ? "B"
                  : currentNumber <= 30
                    ? "I"
                    : currentNumber <= 45
                      ? "N"
                      : currentNumber <= 60
                        ? "G"
                        : "O"}
                -{currentNumber}
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-xl px-5 py-2 border border-white/10">
              <div className="text-white/30 text-[10px] uppercase tracking-widest text-center font-bold">
                Starting in
              </div>
              <div className="text-white/40 font-black text-2xl text-center">
                {startCountdown > 0 ? startCountdown : "..."}
              </div>
            </div>
          )}
        </div> */}

        {/* Previously Called Numbers with animation */}
        {calledNumbers.length > 0 && (
          <div className="px-3 pb-1 flex-shrink-0">
            <div className="text-white/30 text-[8px] uppercase tracking-widest font-bold mb-1 text-center">
              Recently Called
            </div>
            <div className="flex justify-center gap-1.5 flex-wrap relative">
              <AnimatePresence mode="popLayout">
                {/* Show current call + 5 most recent (excluding current if already in slice) */}
                {(() => {
                  // Get last 5 calls excluding current? Or include current?
                  // This shows current + 4 previous = 5 total
                  const lastFive = calledNumbers.slice(-5).reverse();

                  return lastFive.map((n, i) => {
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
                      B: "bg-blue-500/30 text-blue-200 border-blue-400/40",
                      I: "bg-green-500/30 text-green-200 border-green-400/40",
                      N: "bg-purple-500/30 text-purple-200 border-purple-400/40",
                      G: "bg-red-500/30 text-red-200 border-red-400/40",
                      O: "bg-yellow-500/30 text-yellow-200 border-yellow-400/40",
                    };

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
                          rotate: isCurrent ? 0 : 0,
                        }}
                        exit={{ opacity: 0, scale: 0.3, y: -20 }}
                        transition={{
                          type: "spring",
                          damping: isCurrent ? 10 : 15,
                          stiffness: isCurrent ? 200 : 250,
                          delay: isCurrent ? 0 : i * 0.05,
                        }}
                        whileHover={{ scale: 1.1 }}
                        className={`
                  rounded-full px-2 py-2 flex items-center justify-center 
                  text-[11px] font-extrabold font-mono border shadow-lg 
                  ${colors[letter]}
                  ${
                    isCurrent
                      ? "ring-4 ring-yellow-400 ring-offset-2 ring-offset-purple-900 scale-110 bg-opacity-80 shadow-2xl shadow-yellow-500/50"
                      : i === 0 && !isCurrent
                        ? "ring-1 ring-blue-400/50 ring-offset-1 ring-offset-[var(--cardbackground)]"
                        : ""
                  }
                `}
                        style={{
                          boxShadow: isCurrent
                            ? "0 0 20px rgba(234, 179, 8, 0.6)"
                            : undefined,
                        }}
                      >
                        {isCurrent && (
                          <motion.div
                            className="absolute -top-2 -right-2"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                          >
                            <div className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                              LIVE
                            </div>
                          </motion.div>
                        )}
                        <motion.span
                          initial={isCurrent ? { scale: 0 } : {}}
                          animate={isCurrent ? { scale: 1 } : {}}
                          transition={{ duration: 0.3, delay: 0.15 }}
                          className={
                            isCurrent ? "text-white drop-shadow-lg" : ""
                          }
                        >
                          {letter}
                          {n}
                        </motion.span>
                      </motion.div>
                    );
                  });
                })()}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Number Board - Vertical BINGO */}
        <div className="px-3 pb-1 flex-shrink-0">
          <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full border-collapse">
              <tbody>
                {[
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
                ].map(({ letter, color, nums }) => (
                  <tr key={letter}>
                    <td
                      className={`text-center text-[11px] font-black py-0.5 w-[8%] ${color}`}
                    >
                      {letter}
                    </td>
                    {nums.map((n) => {
                      const isCalled = calledNumbers.includes(n);
                      const isCurrent = currentNumber === n;
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

        {/* Cartella - fills remaining space */}
        <main className="flex-1 px-3 pb-1.5 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center overflow-y-auto">
            {hasSingleCartela ? (
              <div className="w-full max-w-[300px] mx-auto">
                {yourCards.map(({ cardNumber, card }) => {
                  const markedNumbers = isAutoMarkOn
                    ? calledNumbers
                    : manuallyMarkedNumbers[cardNumber]
                      ? Array.from(manuallyMarkedNumbers[cardNumber])
                      : [];
                  return (
                    <CartellaCard
                      key={cardNumber}
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
                      showHeader={true}
                      isAutoMarkOn={isAutoMarkOn}
                      onNumberToggle={
                        !isAutoMarkOn
                          ? (number) => handleNumberToggle(cardNumber, number)
                          : undefined
                      }
                      missedWinningCalledNumbers={
                        missedClaimWindow && missedPatternCalledSnapshot
                          ? missedPatternCalledSnapshot
                          : null
                      }
                    />
                  );
                })}
              </div>
            ) : isWatchMode ? (
              <div className="text-center">
                <div className="text-4xl mb-2">👀</div>
                <p className="text-white/50 text-sm font-bold">Watch Mode</p>
              </div>
            ) : null}
          </div>

          {/* BINGO Button - always visible */}
          {hasSingleCartela && gameState.phase === "running" && (
            <div className="flex-shrink-0 pt-1">
              <button
                onClick={handleManualBingo}
                disabled={isManualClaiming || !connected}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-black text-lg uppercase tracking-widest shadow-lg shadow-red-500/50 hover:from-red-500 hover:to-pink-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isManualClaiming ? "⏳" : "BINGO!"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
