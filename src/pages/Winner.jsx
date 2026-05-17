import React, { useEffect, useState } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../lib/auth/AuthProvider";
import CartellaCard from "../components/CartellaCard";
import { motion, AnimatePresence } from "framer-motion";
import { FaTrophy, FaCrown, FaUsers, FaClock } from "react-icons/fa";
import { GiConfirmed, GiTrophyCup } from "react-icons/gi";

function cardDataFromWinner(winner) {
  if (!winner) return null;
  try {
    if (winner.card && Array.isArray(winner.card) && winner.card.length === 5) {
      return winner.card;
    }
    if (
      winner.cardNumbers &&
      Array.isArray(winner.cardNumbers) &&
      winner.cardNumbers.length === 25
    ) {
      return [
        winner.cardNumbers.slice(0, 5),
        winner.cardNumbers.slice(5, 10),
        winner.cardNumbers.slice(10, 15),
        winner.cardNumbers.slice(15, 20),
        winner.cardNumbers.slice(20, 25),
      ];
    }
  } catch (e) {
    console.error("Error processing card data:", e);
  }
  return null;
}

function calledNumbersForWinner(winner, gameCalledNumbers) {
  const winnerCalled = Array.isArray(winner?.called) ? winner.called : [];
  const gameCalled = Array.isArray(gameCalledNumbers) ? gameCalledNumbers : [];
  return winnerCalled.length > 0 ? winnerCalled : gameCalled;
}

function dedupeWinningCartelas(winners) {
  const out = [];
  const seen = new Set();
  for (const w of winners) {
    const uid = String(w.userId ?? w.sessionId ?? "");
    const cid = String(w.cartelaNumber ?? w.cartela?.cartelaNumber ?? "");
    const key = `${uid}::${cid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

export default function Winner({ onNavigate, onResetToGame }) {
  const { gameState } = useWebSocket();
  const { sessionId } = useAuth();
  const [countdown, setCountdown] = useState(0);
  // const { gameState } = useWebSocket();
  // const { sessionId } = useAuth();
  const { yourCards } = gameState;

  // If user has no cards (watch mode), redirect to cartela selection
  const hasCards = yourCards?.length > 0;

  useEffect(() => {
    if (!hasCards && gameState.phase === "announce") {
      onNavigate?.("cartela-selection");
    }
  }, [hasCards, gameState.phase, onNavigate]);

  useEffect(() => {
    const updateCountdown = () => {
      if (gameState.nextRegistrationStart) {
        const remaining = Math.max(
          0,
          Math.ceil((gameState.nextRegistrationStart - Date.now()) / 1000),
        );
        setCountdown(remaining);
      } else {
        setCountdown(0);
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [gameState.nextRegistrationStart]);

  useEffect(() => {
    if (gameState.phase === "registration") {
      onNavigate?.("cartela-selection");
    }
  }, [gameState.phase, onNavigate]);

  const winners = gameState.winners || [];
  const displayWinners = dedupeWinningCartelas(winners);
  const isMultiCartelas = displayWinners.length > 1;
  const hasWinners = winners.length > 0;

  const isCurrentUserWinner =
    sessionId &&
    winners.some(
      (w) =>
        w.userId === sessionId ||
        w.sessionId === sessionId ||
        (w.user && w.user.id && w.user.id.toString() === sessionId?.toString()),
    );

  const getWinnerDisplayName = (winner) =>
    winner.name ||
    winner.playerName ||
    winner.firstName ||
    (winner.cartelaNumber ? `Cartella #${winner.cartelaNumber}` : "Winner");

  const uniqueWinners = [];
  const seenKeys = new Set();
  winners.forEach((w) => {
    const key =
      w.userId ||
      w.sessionId ||
      (w.user && w.user.id) ||
      getWinnerDisplayName(w);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueWinners.push(w);
    }
  });

  const winnerNames = uniqueWinners.map(getWinnerDisplayName);
  const gameCalled = Array.isArray(gameState.calledNumbers)
    ? gameState.calledNumbers
    : [];

  // No winner state
  if (!hasWinners) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm"
        >
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <GiTrophyCup className="text-yellow-400" size={28} />
            </div>
            <h1 className="text-white font-bold text-2xl mb-2">Game Over</h1>
            <p className="text-white/40 text-sm">No winners this round</p>
          </div>

          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl py-5 px-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <FaClock className="text-white/30" size={14} />
              <p className="text-white/40 text-xs uppercase tracking-wider">
                Next Game
              </p>
            </div>
            <div className="text-white font-bold text-5xl">
              {countdown > 0 ? countdown : "--"}
            </div>
            <p className="text-white/30 text-xs mt-2">
              {countdown > 0 ? `Starting in ${countdown}s` : "Preparing..."}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-md mx-auto px-4 py-6 pb-24">
        {/* Winner Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur border border-yellow-500/30 rounded-2xl p-5 text-center mb-4"
        >
          <div className="flex justify-center gap-2 mb-3">
            {["🎉", "🏆", "🎊"].map((emoji, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.1, type: "spring" }}
                className="text-2xl"
              >
                {emoji}
              </motion.span>
            ))}
          </div>

          <div className="flex items-center justify-center gap-2 mb-3">
            <FaTrophy className="text-yellow-400" size={24} />
            <h1 className="text-white font-black text-3xl tracking-wider">
              BINGO!
            </h1>
          </div>

          {/* Winner names */}
          <div className="space-y-2">
            {winnerNames.slice(0, 3).map((name, idx) => (
              <div
                key={`${name}-${idx}`}
                className="flex items-center justify-center gap-2 flex-wrap"
              >
                <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-emerald-200 font-bold text-sm">
                  {idx === 0 && (
                    <FaCrown
                      className="inline mr-1 text-yellow-400"
                      size={12}
                    />
                  )}
                  {name}
                </div>
                {idx === 0 && winnerNames.length === 1 && (
                  <span className="text-white/50 text-xs">won the game!</span>
                )}
                {idx === 0 && winnerNames.length > 1 && (
                  <span className="text-amber-400/80 text-xs font-medium flex items-center gap-1">
                    <FaUsers size={10} /> +{winnerNames.length - 1} more
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Current user won badge */}
          {isCurrentUserWinner && (
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 border border-green-400/30">
              <GiConfirmed size={12} className="text-green-400" />
              <span className="text-green-400 text-xs font-bold">You won!</span>
            </div>
          )}
        </motion.div>

        {/* Winning Cards */}
        {displayWinners.length > 0 && (
          <div
            className={`space-y-3 mb-4 ${isMultiCartelas ? "max-h-[50vh] overflow-y-auto" : ""}`}
          >
            {displayWinners.map((w, idx) => {
              const cardData = cardDataFromWinner(w);
              const calledNumbers = calledNumbersForWinner(w, gameCalled);
              const boardNumber = w.cartelaNumber || w.cardId || "N/A";
              const label = getWinnerDisplayName(w);

              return (
                <motion.div
                  key={`${String(w.userId)}-${boardNumber}-${idx}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-3"
                >
                  {isMultiCartelas && (
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="text-white/50 text-[10px] font-medium">
                        Winner
                      </span>
                      <span className="text-yellow-400 text-xs font-bold">
                        {label}
                      </span>
                      <span className="text-white/30 text-[10px]">
                        · #{boardNumber}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-center">
                    {cardData ? (
                      <CartellaCard
                        id={boardNumber}
                        card={cardData}
                        called={calledNumbers}
                        isPreview={false}
                        showWinningPattern={true}
                        showHeader={!isMultiCartelas}
                        size={isMultiCartelas ? "small" : "normal"}
                      />
                    ) : (
                      <div className="bg-white/5 rounded-xl p-4 text-center w-full max-w-xs">
                        <div className="text-2xl mb-1">🏆</div>
                        <p className="text-white/40 text-xs">
                          Cartella #{boardNumber}
                        </p>
                      </div>
                    )}
                  </div>
                  {!isMultiCartelas && (
                    <p className="text-center text-white/30 text-[10px] mt-2">
                      Cartella #{boardNumber}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Countdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur border border-white/10 rounded-xl py-4 px-4 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <FaClock className="text-white/30" size={12} />
            <p className="text-white/40 text-[10px] uppercase tracking-wider">
              Next Game
            </p>
          </div>
          <div className="text-white font-bold text-4xl">
            {countdown > 0 ? countdown : "--"}
          </div>
          <p className="text-white/30 text-[10px] mt-1">
            {countdown > 0
              ? `Starting in ${countdown} seconds`
              : "Preparing next game..."}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
