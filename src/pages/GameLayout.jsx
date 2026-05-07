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
    const id = setTimeout(() => {
      try {
        preloadNumberSounds();
      } catch {
        console.warn("Failed to preload number sounds");
      }
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
        const prevCalled = calledNumbers.slice(0, i - 1);
        if (checkBingoPattern(card, prevCalled) && !claimedBingoRef.current) {
          setMissedClaimWindow(true);
          setMissedPatternCalledSnapshot([...prevCalled]);
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
        console.warn("Manual BINGO claim send failed");
        claimedBingoRef.current = false;
        showError("Failed to send BINGO claim. Please try again.");
      } else showSuccess("BINGO claim sent! Waiting for confirmation...");
    } catch (error) {
      console.error("Error sending manual BINGO claim:", error);
      claimedBingoRef.current = false;
      showError("Failed to send BINGO claim. Please try again.");
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

  // Auto-claim BINGO when winning pattern is detected in auto-mark mode
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
    if (checkBingoPattern(card, calledNumbers)) {
      console.log("🎯 Auto-BINGO detected! Claiming...");
      handleManualBingo();
    }
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
    const timer = setTimeout(
      () => setStartCountdown((prev) => (prev > 0 ? prev - 1 : 0)),
      1000,
    );
    return () => clearTimeout(timer);
  }, [startCountdown]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      showSuccess("🔄 Refreshing game data...");
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (stake && sessionId) {
        connectToStake(stake);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      showSuccess("✅ Game data refreshed successfully!");
    } catch (error) {
      console.log(error);
      showError(
        "❌ Failed to refresh game data. Please check your connection.",
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (gameState.phase === "announce" && !isRefreshing) {
      const winners = gameState.winners || [];
      if (winners.length > 0) {
        const winnerNames = winners.map((w) => w.name || "Player").join(", ");
        showSuccess(
          winners.some((w) => w.userId === sessionId)
            ? `🎉 Congratulations! You won! ${winners.length > 1 ? `(Shared with ${winners.length - 1} other${winners.length > 2 ? "s" : ""})` : ""}`
            : `🏆 Game Over! Winner${winners.length > 1 ? "s" : ""}: ${winnerNames}`,
        );
      } else showSuccess("🏆 Game Over!");
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
      const timeout = setTimeout(() => setShowTimeout(true), 5000);
      return () => clearTimeout(timeout);
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
    const handleBingoRejected = (event) => {
      claimedBingoRef.current = false;
      const reason = event?.detail?.reason || "invalid_claim";
      if (reason === "invalid_claim") {
        setManuallyMarkedNumbers({});
        setAlertBanners((prev) => [
          ...prev,
          "Invalid BINGO! Marks cleared. Try again.",
        ]);
      } else if (reason === "stale_claim") {
        setAlertBanners((prev) => [
          ...prev,
          "Pattern already passed. Wait for next call.",
        ]);
      }
    };
    window.addEventListener("bingoRejected", handleBingoRejected);
    return () =>
      window.removeEventListener("bingoRejected", handleBingoRejected);
  }, []);

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

  if (isRefreshing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mx-auto mb-4" />
          <p className="text-white/80 text-lg">Refreshing...</p>
        </div>
      </div>
    );
  }
  if (!currentGameId && !connected && !isRefreshing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-4">🎮</div>
          <div className="text-white text-lg mb-2">Connecting to game...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
          {showTimeout && (
            <div className="mt-4">
              <button
                onClick={() => onNavigate?.("cartela-selection")}
                className="px-6 py-3 bg-pink-600 text-white rounded-lg font-semibold"
              >
                Back to Cartella Selection
              </button>
            </div>
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

  // Previous calls for display
  const previousCalls =
    calledNumbers.length > 1 ? calledNumbers.slice(-5, -1).reverse() : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
      {/* Alert Banners */}
      {alertBanners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
          {alertBanners.map((alertMsg, index) => (
            <div
              key={index}
              className="alert-banner-appeal animate-slide-in"
              style={{ animationDelay: `${index * 0.1}s` }}
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
              <div className="alert-message-text">{alertMsg}</div>
              <button
                onClick={() =>
                  setAlertBanners((prev) => prev.filter((_, i) => i !== index))
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
        {/* Header - Compact */}
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isSoundOn ? "bg-white/20 text-white" : "bg-white/5 text-white/30"}`}
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isAutoMarkOn ? "bg-green-500/30 text-green-200" : "bg-white/5 text-white/30"}`}
              >
                {isAutoMarkOn ? "🟢" : "✋"}
              </button>
              <button
                onClick={handleRefresh}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-white/5 text-white/50 hover:bg-white/15 transition-all font-bold"
              >
                🔄
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-white/40 font-bold">Game</span>{" "}
              <span className="text-white/70 font-bold">
                {currentGameId ? currentGameId.replace("LB", "#") : "---"}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-white/40 font-bold">Derash</span>{" "}
              <span className="text-amber-300 font-extrabold">
                {currentPrizePool || 0}
              </span>
            </div>
          </div>
          {/* Second row: Players, Stake, Calls, Previous calls */}
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-white/40 font-bold">Players</span>{" "}
              <span className="text-blue-300 font-extrabold">
                {currentPlayersCount || 0}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-white/40 font-bold">Stake</span>{" "}
              <span className="text-green-300 font-extrabold">
                {stake || 0}
              </span>
              <span className="text-white/20">|</span>
              <span className="text-white/40 font-bold">Calls</span>{" "}
              <span className="text-pink-300 font-extrabold">
                {calledNumbers.length}/75
              </span>
            </div>
            {previousCalls.length > 0 && (
              <div className="flex items-center gap-1">
                {previousCalls.map((n, i) => {
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
                  return (
                    <div
                      key={i}
                      className="bg-white/10 rounded-md px-1.5 py-0.5 text-white/60 text-[10px] font-bold font-mono"
                    >
                      {letter}
                      {n}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* Current Call */}
        <div className="px-3 pb-1.5 flex-shrink-0 flex justify-center">
          {currentNumber ? (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl px-5 py-2 shadow-lg shadow-orange-500/40">
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
        </div>

        {/* Number Board - Vertical BINGO: 5 rows, letter then 15 numbers each */}
        <div className="px-3 pb-1.5 flex-shrink-0">
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
                      className={`text-center text-xs font-black py-1 w-[10%] ${color}`}
                    >
                      {letter}
                    </td>
                    {nums.map((n) => {
                      const isCalled = calledNumbers.includes(n);
                      const isCurrent = currentNumber === n;
                      return (
                        <td
                          key={n}
                          className={`text-center text-[11px] py-1 font-bold ${
                            isCurrent
                              ? "bg-orange-500 text-white font-extrabold rounded shadow-lg shadow-orange-500/50"
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

        {/* Cartella + BINGO Button */}
        <main className="flex-1 px-3 pb-2 overflow-y-auto flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center">
            {hasSingleCartela ? (
              <div className="bg-white/5 backdrop-blur rounded-2xl p-2 border border-white/10 w-full max-w-[220px] mx-auto">
                {yourCards.map(({ cardNumber, card }) => {
                  const markedNumbers = isAutoMarkOn
                    ? calledNumbers
                    : manuallyMarkedNumbers[cardNumber]
                      ? Array.from(manuallyMarkedNumbers[cardNumber])
                      : [];
                  return (
                    <div
                      key={cardNumber}
                      className="w-full flex flex-col items-center gap-1"
                    >
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
                      <div className="text-[10px] font-bold text-white/40">
                        Board #{cardNumber}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isWatchMode ? (
              <div className="text-center">
                <div className="text-4xl mb-2">👀</div>
                <h3 className="text-white text-base font-bold mb-1">
                  Watch Mode
                </h3>
                <p className="text-white/50 text-xs">
                  Game in progress. Wait for next round.
                </p>
              </div>
            ) : null}
          </div>

          {hasSingleCartela && gameState.phase === "running" && (
            <div className="flex-shrink-0 pt-1.5">
              <button
                onClick={handleManualBingo}
                disabled={isManualClaiming || !connected}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-black text-lg uppercase tracking-widest shadow-lg shadow-red-500/50 hover:from-red-500 hover:to-pink-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isManualClaiming ? "⏳ Sending..." : "BINGO!"}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
