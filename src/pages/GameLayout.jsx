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

    const topLeft = cartella[0][0];
    const topRight = cartella[0][4];
    const bottomLeft = cartella[4][0];
    const bottomRight = cartella[4][4];

    if (
      (topLeft === 0 || calledNumbers.includes(topLeft)) &&
      (topRight === 0 || calledNumbers.includes(topRight)) &&
      (bottomLeft === 0 || calledNumbers.includes(bottomLeft)) &&
      (bottomRight === 0 || calledNumbers.includes(bottomRight))
    ) {
      return true;
    }
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
    if (isAutoMarkOn && Object.keys(manuallyMarkedNumbers).length > 0) {
      setManuallyMarkedNumbers({});
    }
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
    if (isSoundOn && typeof currentNumber === "number") {
      playNumberSound(currentNumber).catch(() => {});
    }
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
        if (newCardMarks.has(number)) newCardMarks.delete(number);
        else newCardMarks.add(number);
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
        showError("Failed to send BINGO claim. Please try again.");
      } else {
        showSuccess("BINGO claim sent! Waiting for confirmation...");
      }
    } catch (error) {
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

  // Keep all original useEffects unchanged...

  const gamePhaseDisplay =
    gameState.phase === "running"
      ? "LIVE"
      : gameState.phase === "registration"
        ? "REG"
        : "WAIT";

  const hasSingleCartela = yourCards.length === 1;
  const isWatchMode = yourCards.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white">
      {alertBanners.length > 0 && (
        <div className="fixed top-4 inset-x-0 z-50 px-4 space-y-3 max-w-3xl mx-auto">
          {alertBanners.map((alertMsg, index) => (
            <div
              key={index}
              className="backdrop-blur-xl bg-red-500/15 border border-red-400/30 rounded-2xl p-4 flex items-center justify-between shadow-2xl"
            >
              <span className="text-sm sm:text-base font-medium">
                {alertMsg}
              </span>
              <button
                onClick={() =>
                  setAlertBanners((prev) => prev.filter((_, i) => i !== index))
                }
                className="text-white/60 hover:text-white transition"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <header className="sticky top-3 z-40 backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-4 mb-6 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={`px-4 py-2 rounded-full text-sm font-bold tracking-wide border ${
                  gameState.phase === "running"
                    ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : gameState.phase === "registration"
                      ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                      : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                }`}
              >
                {startCountdown > 0 ? startCountdown : gamePhaseDisplay}
              </div>

              <button
                onClick={() => setIsSoundOn(!isSoundOn)}
                className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg transition"
              >
                {isSoundOn ? "🔊" : "🔇"}
              </button>

              <button
                onClick={() => setIsAutoMarkOn(!isAutoMarkOn)}
                className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg transition"
              >
                {isAutoMarkOn ? "🟢" : "✋"}
              </button>

              <button
                onClick={handleRefresh}
                className="w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg transition"
              >
                🔄
              </button>
            </div>

            <div className="text-left lg:text-right">
              <div className="text-xs uppercase tracking-[0.25em] text-white/40">
                Game ID
              </div>
              <div className="font-mono text-lg font-semibold text-white/90">
                {currentGameId ? currentGameId.replace("LB", "#") : "---"}
              </div>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            ["Prize", currentPrizePool],
            ["Players", currentPlayersCount],
            ["Stake", stake],
            ["Calls", `${calledNumbers.length}/75`],
          ].map(([label, value]) => (
            <div
              key={label}
              className="bg-white/5 hover:bg-white/10 transition backdrop-blur-xl rounded-3xl border border-white/10 p-4 text-center shadow-lg"
            >
              <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
                {label}
              </div>
              <div className="text-xl sm:text-2xl font-bold">{value}</div>
            </div>
          ))}
        </section>

        {currentNumber && (
          <section className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-3xl px-10 py-6 shadow-2xl animate-pulse">
              <div className="text-center text-xs uppercase tracking-[0.35em] text-white/70 mb-2">
                Current Call
              </div>
              <div className="text-4xl sm:text-6xl font-black text-center tracking-wide">
                {(currentNumber <= 15 && "B") ||
                  (currentNumber <= 30 && "I") ||
                  (currentNumber <= 45 && "N") ||
                  (currentNumber <= 60 && "G") ||
                  "O"}
                -{currentNumber}
              </div>
            </div>
          </section>
        )}

        <main className="grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            {hasSingleCartela ? (
              <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl p-4 sm:p-6 shadow-xl">
                {yourCards.map(({ cardNumber, card }) => {
                  const markedNumbers = isAutoMarkOn
                    ? calledNumbers
                    : manuallyMarkedNumbers[cardNumber]
                      ? Array.from(manuallyMarkedNumbers[cardNumber])
                      : [];

                  return (
                    <div
                      key={cardNumber}
                      className="flex flex-col items-center gap-4"
                    >
                      <CartellaCard
                        id={cardNumber}
                        card={card}
                        called={isAutoMarkOn ? calledNumbers : markedNumbers}
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
                      <span className="text-sm text-white/50 font-medium">
                        Board #{cardNumber}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : isWatchMode ? (
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-12 text-center shadow-xl">
                <div className="text-7xl mb-4">👀</div>
                <h3 className="text-2xl font-bold mb-2">Watch Mode</h3>
                <p className="text-white/60">
                  Game in progress. Wait for the next round.
                </p>
              </div>
            ) : null}

            {gameState.phase === "running" && hasSingleCartela && (
              <button
                onClick={handleManualBingo}
                disabled={isManualClaiming || !connected}
                className="w-full py-5 rounded-3xl bg-gradient-to-r from-rose-500 via-red-500 to-pink-600 text-white text-2xl font-black tracking-[0.3em] shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50"
              >
                {isManualClaiming ? "⏳ Sending..." : "BINGO!"}
              </button>
            )}
          </section>

          <aside className="bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-4 shadow-xl">
            <div className="text-center text-sm uppercase tracking-[0.3em] text-white/50 mb-4">
              Number Board
            </div>

            <div className="grid grid-cols-5 gap-2">
              {["B", "I", "N", "G", "O"].map((letter, colIdx) => (
                <div key={letter} className="space-y-2">
                  <div className="text-center font-bold rounded-xl py-2 bg-white/10">
                    {letter}
                  </div>
                  {Array.from(
                    { length: 15 },
                    (_, i) => colIdx * 15 + i + 1,
                  ).map((n) => {
                    const isCalled = calledNumbers.includes(n);
                    const isCurrent = currentNumber === n;

                    return (
                      <div
                        key={n}
                        className={`text-center text-xs sm:text-sm rounded-lg py-1 font-mono transition ${
                          isCurrent
                            ? "bg-orange-500 text-white scale-110 shadow-lg"
                            : isCalled
                              ? "bg-white/10 text-white/70"
                              : "text-white/25"
                        }`}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
