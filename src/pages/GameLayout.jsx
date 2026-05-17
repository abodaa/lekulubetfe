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
import { CgLivePhoto } from "react-icons/cg";
import { BiRefresh } from "react-icons/bi";
import { LiaToggleOffSolid, LiaToggleOnSolid } from "react-icons/lia";
import { BsInfoCircle } from "react-icons/bs";

export default function GameLayout({ stake, onNavigate }) {
  const { sessionId } = useAuth();
  const { showSuccess, showError } = useToast();
  const [showTimeout, setShowTimeout] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [alertBanners, setAlertBanners] = useState([]);
  const alertTimersRef = useRef(new Map());

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000);
  };

  const checkBingoPattern = (cartella, calledNumbers) => {
    if (!cartella || !Array.isArray(cartella) || cartella.length !== 5)
      return false;
    if (!calledNumbers || !Array.isArray(calledNumbers)) return false;

    const calledSet = new Set(calledNumbers);

    for (let i = 0; i < 5; i++) {
      if (!cartella[i] || !Array.isArray(cartella[i])) continue;
      const rowComplete = cartella[i].every((num) => {
        if (num === 0) return true;
        return calledSet.has(num);
      });
      if (rowComplete) return true;
    }

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
      cartella[0][0],
      cartella[0][4],
      cartella[4][0],
      cartella[4][4],
    ];
    const cornersComplete = corners.every((num) => {
      if (num === 0) return true;
      return calledSet.has(num);
    });
    if (cornersComplete) return true;

    return false;
  };

  const isLastCallPartOfWinningPattern = (card, calledNumbers) => {
    if (!card || !calledNumbers || calledNumbers.length === 0) return false;

    const lastCall = calledNumbers[calledNumbers.length - 1];
    const calledSet = new Set(calledNumbers);

    for (let row = 0; row < 5; row++) {
      if (!card[row]) continue;
      if (
        card[row].every((num) => num === 0 || calledSet.has(num)) &&
        card[row].includes(lastCall)
      )
        return true;
    }
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
    let d1 = true,
      h1 = false;
    for (let i = 0; i < 5; i++) {
      const num = card[i][i];
      if (num !== 0 && !calledSet.has(num)) {
        d1 = false;
        break;
      }
      if (num === lastCall) h1 = true;
    }
    if (d1 && h1) return true;

    let d2 = true,
      h2 = false;
    for (let i = 0; i < 5; i++) {
      const num = card[i][4 - i];
      if (num !== 0 && !calledSet.has(num)) {
        d2 = false;
        break;
      }
      if (num === lastCall) h2 = true;
    }
    if (d2 && h2) return true;

    const corners = [card[0][0], card[0][4], card[4][0], card[4][4]];
    if (
      corners.every((num) => num === 0 || calledSet.has(num)) &&
      corners.includes(lastCall)
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
  const [claimingStates, setClaimingStates] = useState({});
  const [startCountdown, setStartCountdown] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [missedWinningPatterns, setMissedWinningPatterns] = useState({});
  const confettiRef = useRef(null);

  // Swipe gesture refs
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const sliderRef = useRef(null);

  const claimedCartellasRef = useRef(new Set());
  const lastGameIdRef = useRef(null);
  const missedPatternsPersistentRef = useRef({});
  const [missedPatterns, setMissedPatterns] = useState({});

  // Swipe handlers
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (yourCards.length <= 1) return;

    const swipeThreshold = 50;
    const diff = touchStartX.current - touchEndX.current;

    if (Math.abs(diff) < swipeThreshold) return;

    if (diff > 0) {
      // Swipe left - next card
      setCurrentCardIndex((prev) => Math.min(yourCards.length - 1, prev + 1));
    } else {
      // Swipe right - previous card
      setCurrentCardIndex((prev) => Math.max(0, prev - 1));
    }

    // Reset touch positions
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

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

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        preloadNumberSounds();
      } catch {
        showError("Failed to preload number sounds.");
      }
    }, 1000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (isSoundOn && typeof currentNumber === "number" && !isWatchMode)
      playNumberSound(currentNumber).catch(() => {});
  }, [currentNumber, isSoundOn]);

  useEffect(() => {
    if (currentGameId !== lastGameIdRef.current) {
      claimedCartellasRef.current.clear();
      lastGameIdRef.current = currentGameId;
      setClaimingStates({});
      setMissedPatterns({});
      missedPatternsPersistentRef.current = {};
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

      // For manual mode, verify winning pattern before sending
      if (!isAutoMarkOn) {
        const hasWin = checkBingoPattern(card, calledNumbers);
        if (!hasWin) {
          showError(`No winning pattern on Cartella #${cardNumber}`);
          return;
        }
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
            const newPatterns = { ...prev };
            delete newPatterns[cardNumber];
            return newPatterns;
          });
          delete missedPatternsPersistentRef.current[cardNumber];
        }
      } catch (err) {
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
    ],
  );

  // Track missed winning patterns (when the last call that completes a pattern passes)
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

      // Check if current card has a winning pattern NOW
      const hasWinNow = checkBingoPattern(card, calledNumbers);

      // Check if card had a winning pattern on the PREVIOUS call
      const previousCalled = calledNumbers.slice(0, -1);
      const hadWinBefore =
        previousCalled.length > 0
          ? checkBingoPattern(card, previousCalled)
          : false;

      // If it had a winning pattern before but doesn't now, it was missed
      if (hadWinBefore && !hasWinNow) {
        if (!newMissedPatterns[cardNumber]) {
          console.log(
            `🔴 Missed winning pattern for Cartella #${cardNumber} at call ${calledNumbers.length}`,
          );
          newMissedPatterns[cardNumber] = previousCalled;
        }
      }

      // If it has a winning pattern now, clear missed status
      if (hasWinNow && newMissedPatterns[cardNumber]) {
        delete newMissedPatterns[cardNumber];
      }
    }

    setMissedWinningPatterns(newMissedPatterns);
  }, [calledNumbers, gameState.phase, yourCards]);

  // AUTO-BINGO for multiple cartellas
  useEffect(() => {
    if (gameState.phase !== "running") return;
    if (!isAutoMarkOn) return;
    if (yourCards.length === 0) return;

    for (const { cardNumber, card } of yourCards) {
      if (claimedCartellasRef.current.has(cardNumber)) continue;

      const hasWin = checkBingoPattern(card, calledNumbers);
      if (!hasWin) continue;

      const lastNumberInPattern = isLastCallPartOfWinningPattern(
        card,
        calledNumbers,
      );
      if (!lastNumberInPattern) continue;

      claimedCartellasRef.current.add(cardNumber);
      triggerConfetti();
      claimBingo({ cardNumber });
      showSuccess(`🎉 Auto-BINGO! Cartella #${cardNumber} won!`);

      setMissedPatterns((prev) => {
        const newPatterns = { ...prev };
        delete newPatterns[cardNumber];
        return newPatterns;
      });
      delete missedPatternsPersistentRef.current[cardNumber];

      break;
    }
  }, [
    calledNumbers,
    gameState.phase,
    isAutoMarkOn,
    yourCards,
    claimBingo,
    showSuccess,
  ]);

  // TRACK MISSED WINNING PATTERNS
  useEffect(() => {
    if (gameState.phase !== "running") {
      setMissedPatterns({});
      return;
    }
    if (yourCards.length === 0) return;

    const newMissedPatterns = { ...missedPatterns };
    let hasChanges = false;

    for (const { cardNumber, card } of yourCards) {
      if (claimedCartellasRef.current.has(cardNumber)) {
        if (newMissedPatterns[cardNumber]) {
          delete newMissedPatterns[cardNumber];
          delete missedPatternsPersistentRef.current[cardNumber];
          hasChanges = true;
        }
        continue;
      }

      const hasWin = checkBingoPattern(card, calledNumbers);

      if (hasWin) {
        if (
          newMissedPatterns[cardNumber] ||
          missedPatternsPersistentRef.current[cardNumber]
        ) {
          delete newMissedPatterns[cardNumber];
          delete missedPatternsPersistentRef.current[cardNumber];
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      setMissedPatterns(newMissedPatterns);
    }
  }, [calledNumbers, gameState.phase, yourCards, missedPatterns]);

  // Recovery: If a cartella has a winning pattern but is incorrectly marked as claimed, reset it
  useEffect(() => {
    if (gameState.phase !== "running") return;
    if (yourCards.length === 0) return;

    for (const { cardNumber, card } of yourCards) {
      const hasWin = checkBingoPattern(card, calledNumbers);
      if (hasWin && claimedCartellasRef.current.has(cardNumber)) {
        console.log(
          `⚠️ Resetting claimed status for Cartella #${cardNumber} - has winning pattern but was marked claimed`,
        );
        claimedCartellasRef.current.delete(cardNumber);
      }
    }
  }, [calledNumbers, gameState.phase, yourCards]);

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
      showError("Failed to refresh game state.");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (gameState.phase === "announce" && !isRefreshing && !isWatchMode) {
      const winners = gameState.winners || [];
      if (winners.length > 0) {
        const userWon = winners.some((w) => w.userId === sessionId);
        if (userWon) {
          showSuccess("🎉 You won!");
        }
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
  const isWatchMode = yourCards.length === 0;

  const letters = ["B", "I", "N", "G", "O"];
  const letterColors = [
    "bg-blue-500/30 text-blue-200",
    "bg-green-500/30 text-green-200",
    "bg-purple-500/30 text-purple-200",
    "bg-red-500/30 text-red-200",
    "bg-yellow-500/30 text-yellow-200",
  ];

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
                className={`px-1 py-0.5 text-xl rounded-full font-bold ${isAutoMarkOn ? " text-green-600 bg-green-600/20" : "text-white/70 bg-white/20"}`}
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
          <div className="grid grid-cols-4 gap-1.5">
            <div className="flex items-center justify-center gap-1 bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/30 text-[10px]">Prize : </p>
              <p className="text-white font-bold text-xs">
                {currentPrizePool || 0}
              </p>
            </div>
            <div className="flex items-center justify-center gap-1 bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/30 text-[10px]">Players : </p>
              <p className="text-white font-bold text-xs">
                {currentPlayersCount || 0}
              </p>
            </div>
            <div className="flex items-center justify-center gap-1 bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/30 text-[10px]">Stake : </p>
              <p className="text-white font-bold text-xs">{stake || 0}</p>
            </div>
            <div className="flex items-center justify-center gap-1 bg-white/5 rounded-lg p-1 text-center border border-white/10">
              <p className="text-white/30 text-[10px]">Calls : </p>
              <p className="text-white font-bold text-xs">
                {calledNumbers.length}/75
              </p>
            </div>
          </div>
        </div>

        {/* Previously Called Numbers */}
        {!isWatchMode && (
          <>
            {calledNumbers.length > 0 ? (
              <div className="px-3 pb-1 flex-shrink-0 my-2">
                <div className="flex justify-center gap-1.5 flex-wrap relative">
                  <AnimatePresence mode="popLayout">
                    {(() => {
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
                              rounded-full w-8 h-8 flex items-center justify-center 
                              text-[11px] font-extrabold font-mono border
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
            ) : (
              <p className="text-white text-[11px] uppercase tracking-widest font-bold mb-1 text-center">
                Starts in {startCountdown > 0 ? startCountdown : "0"} secs
              </p>
            )}

            {/* Number Board */}
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
          </>
        )}

        {/* Cartellas */}
        <main className="flex-1 px-3 pb-1.5 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto">
            {yourCards.length > 0 ? (
              <div className="relative">
                {/* Slider Container with Swipe Support */}
                <div
                  className="overflow-hidden"
                  ref={sliderRef}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{
                      transform: `translateX(-${currentCardIndex * 100}%)`,
                    }}
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
                        <div
                          key={cardNumber}
                          className="w-full flex-shrink-0 px-2"
                          style={{ flex: "0 0 100%" }}
                        >
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

                            {/* BINGO Header */}
                            <div className="grid grid-cols-5 gap-1 mb-2">
                              {["B", "I", "N", "G", "O"].map((letter, idx) => {
                                const colors = [
                                  "bg-blue-500/30 text-blue-200",
                                  "bg-green-500/30 text-green-200",
                                  "bg-purple-500/30 text-purple-200",
                                  "bg-red-500/30 text-red-200",
                                  "bg-yellow-500/30 text-yellow-200",
                                ];
                                return (
                                  <div
                                    key={letter}
                                    className={`text-center text-[10px] font-extrabold py-1.5 rounded-md ${colors[idx]} border border-white/10`}
                                  >
                                    {letter}
                                  </div>
                                );
                              })}
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
                                missedWinningPatterns[cardNumber] || null
                              }
                              size="small"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Navigation Buttons - Only show if more than 1 cartella */}
                {yourCards.length > 1 && (
                  <div className="flex justify-between items-center mt-3">
                    <button
                      onClick={() =>
                        setCurrentCardIndex((prev) => Math.max(0, prev - 1))
                      }
                      disabled={currentCardIndex === 0}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        currentCardIndex === 0
                          ? "bg-white/10 text-white/30 cursor-not-allowed"
                          : "bg-white/20 text-white hover:bg-white/30 active:scale-95"
                      }`}
                    >
                      ◀
                    </button>

                    <div className="flex gap-1.5">
                      {yourCards.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentCardIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            currentCardIndex === idx
                              ? "bg-white w-4"
                              : "bg-white/30 hover:bg-white/50"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        setCurrentCardIndex((prev) =>
                          Math.min(yourCards.length - 1, prev + 1),
                        )
                      }
                      disabled={currentCardIndex === yourCards.length - 1}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        currentCardIndex === yourCards.length - 1
                          ? "bg-white/10 text-white/30 cursor-not-allowed"
                          : "bg-white/20 text-white hover:bg-white/30 active:scale-95"
                      }`}
                    >
                      ▶
                    </button>
                  </div>
                )}

                {/* Counter indicator */}
                {yourCards.length > 1 && (
                  <div className="text-center mt-2">
                    <span className="text-white/40 text-[10px]">
                      {currentCardIndex + 1} / {yourCards.length}
                    </span>
                  </div>
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
                    {/* <div className="absolute inset-0 rounded-full border-2 border-white/10 animate-ping"></div> */}
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
                        {currentPlayersCount || 0}
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

          {/* Confetti Overlay */}
          {showConfetti && (
            <div className="confetti-container" ref={confettiRef}>
              {Array.from({ length: 50 }).map((_, i) => {
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
                const left = Math.random() * 100;
                const delay = Math.random() * 0.5;
                const size = Math.random() * 8 + 6;
                const color = colors[Math.floor(Math.random() * colors.length)];
                const shape = Math.random() > 0.5 ? "50%" : "2px";
                return (
                  <div
                    key={i}
                    className="confetti-piece"
                    style={{
                      left: `${left}%`,
                      top: `-${Math.random() * 20}px`,
                      width: `${size}px`,
                      height: `${size}px`,
                      backgroundColor: color,
                      borderRadius: shape,
                      animationDelay: `${delay}s`,
                      animationDuration: `${1 + Math.random()}s`,
                    }}
                  />
                );
              })}
              {["🎉", "🎊", "✨", "🌟", "💫", "🏆", "⭐", "🎯"].map(
                (emoji, i) => (
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
                ),
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
