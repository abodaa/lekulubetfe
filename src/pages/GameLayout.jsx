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
    const tl = cartella[0][0],
      tr = cartella[0][4],
      bl = cartella[4][0],
      br = cartella[4][4];
    if (
      (tl === 0 || calledNumbers.includes(tl)) &&
      (tr === 0 || calledNumbers.includes(tr)) &&
      (bl === 0 || calledNumbers.includes(bl)) &&
      (br === 0 || calledNumbers.includes(br))
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

  const [isSoundOn, setIsSoundOn] = useState(true);
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

  // Auto-claim BINGO in auto-mark mode
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
      showSuccess("🔄 Refreshing...");
      await new Promise((r) => setTimeout(r, 100));
      if (stake && sessionId) {
        connectToStake(stake);
        await new Promise((r) => setTimeout(r, 500));
      }
      showSuccess("✅ Refreshed!");
    } catch {
      showError("❌ Refresh failed.");
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
              className="bg-gray-900/95 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white text-sm flex items-center gap-3 shadow-xl font-bold"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <span className="text-lg">⚠️</span>
              <span className="flex-1">{msg}</span>
              <button
                onClick={() =>
                  setAlertBanners((prev) => prev.filter((_, j) => j !== i))
                }
                className="text-gray-400 hover:text-white text-lg font-black"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md mx-auto w-full flex flex-col h-screen">
        {/* Header */}
        <header className="px-3 pt-3 pb-1 flex-shrink-0">
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
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isSoundOn ? "bg-white/20 text-white" : "bg-white/5 text-white/30"}`}
              >
                {isSoundOn ? "🔊" : "🔇"}
              </button>
              <button
                onClick={() => setIsAutoMarkOn(!isAutoMarkOn)}
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isAutoMarkOn ? "bg-green-500/30 text-green-200" : "bg-white/5 text-white/30"}`}
              >
                {isAutoMarkOn ? "🟢" : "✋"}
              </button>
              <button
                onClick={handleRefresh}
                className="w-7 h-7 rounded-full flex items-center justify-center text-sm bg-white/5 text-white/50 hover:bg-white/15 font-bold"
              >
                🔄
              </button>
            </div>
            <div className="text-right">
              <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                Game
              </div>
              <div className="text-white/80 text-[11px] font-bold font-mono">
                {currentGameId ? currentGameId.replace("LB", "#") : "---"}
              </div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="px-3 pb-1 flex-shrink-0">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              {
                label: "Prize",
                value: currentPrizePool || 0,
                color: "text-amber-300",
              },
              {
                label: "Players",
                value: currentPlayersCount || 0,
                color: "text-blue-300",
              },
              { label: "Stake", value: stake || 0, color: "text-green-300" },
              {
                label: "Calls",
                value: `${calledNumbers.length}/75`,
                color: "text-pink-300",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="bg-white/5 rounded-lg p-1.5 text-center border border-white/10"
              >
                <div className="text-white/40 text-[9px] uppercase tracking-widest font-bold">
                  {label}
                </div>
                <div className={`font-extrabold text-sm ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Call */}
        <div className="px-3 pb-1 flex-shrink-0 flex justify-center">
          {currentNumber ? (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl px-5 py-2 shadow-lg shadow-orange-500/40">
              <div className="text-white/90 text-[9px] uppercase tracking-widest text-center font-bold">
                Current Call
              </div>
              <div className="text-white font-black text-xl text-center drop-shadow-lg">
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
              <div className="text-white/30 text-[9px] uppercase tracking-widest text-center font-bold">
                Waiting...
              </div>
            </div>
          )}
        </div>

        {/* Previous Calls */}
        {calledNumbers.length > 1 && (
          <div className="px-3 pb-1 flex-shrink-0 flex justify-center gap-1 flex-wrap">
            {calledNumbers
              .slice(-6, -1)
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
                return (
                  <div
                    key={i}
                    className="bg-white/10 rounded-lg px-2 py-0.5 text-white/60 text-[11px] font-bold font-mono border border-white/10"
                  >
                    {letter}
                    {n}
                  </div>
                );
              })}
          </div>
        )}

        {/* Number Board - Compact */}
        <div className="px-3 pb-1 flex-shrink-0">
          <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 overflow-hidden">
            <div className="grid grid-cols-5 gap-px">
              {["B", "I", "N", "G", "O"].map((letter, colIdx) => (
                <div key={letter} className="space-y-px">
                  <div
                    className={`text-center text-[10px] font-black py-0.5 ${
                      [
                        "bg-blue-600/70 text-blue-100",
                        "bg-green-600/70 text-green-100",
                        "bg-purple-600/70 text-purple-100",
                        "bg-red-600/70 text-red-100",
                        "bg-yellow-600/70 text-yellow-100",
                      ][colIdx]
                    }`}
                  >
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
                        className={`text-center text-[9px] py-0.5 font-bold transition-all ${
                          isCurrent
                            ? "bg-orange-500 text-white scale-110 rounded-sm shadow-lg shadow-orange-500/50 z-10 font-extrabold"
                            : isCalled
                              ? "bg-white/20 text-white font-extrabold"
                              : "text-white/15"
                        }`}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Cartella + BINGO Button */}
        <main className="flex-1 px-3 pb-3 overflow-y-auto flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center">
            {hasSingleCartela ? (
              <div className="bg-white/5 backdrop-blur rounded-2xl p-2 border border-white/10 w-full max-w-[240px] mx-auto">
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
                <p className="text-white/50 text-sm font-bold">Watch Mode</p>
              </div>
            ) : null}
          </div>

          {hasSingleCartela && gameState.phase === "running" && (
            <div className="flex-shrink-0 pt-2">
              <button
                onClick={handleManualBingo}
                disabled={isManualClaiming || !connected}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-pink-600 text-white font-black text-lg uppercase tracking-widest shadow-lg shadow-red-500/50 hover:from-red-500 hover:to-pink-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
