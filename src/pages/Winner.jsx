import React, { useEffect, useState } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../lib/auth/AuthProvider";
import CartellaCard from "../components/CartellaCard";

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
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          {/* BINGO Banner */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-8 shadow-2xl shadow-orange-500/20 mb-6">
            <h1 className="text-white font-extrabold text-5xl tracking-wider drop-shadow-lg mb-4">
              BINGO!
            </h1>
            <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-2 inline-flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              <span className="text-white/90 text-lg font-semibold">
                No Winner This Game
              </span>
            </div>
          </div>

          {/* Countdown */}
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl py-6 px-4 shadow-xl shadow-orange-500/20">
            <p className="text-white/80 text-sm font-medium mb-2">
              አዲስ ጭዋታ ለመጀመር
            </p>
            <div className="text-white font-extrabold text-6xl tracking-wider drop-shadow-lg">
              {countdown > 0 ? countdown : "0"}
            </div>
            <p className="text-white/70 text-xs mt-2">
              {countdown > 0 ? `Next game in ${countdown}s` : "Loading..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md">
        {/* Winner Banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-3xl p-6 shadow-2xl shadow-orange-500/20 mb-4">
          <div className="text-center">
            {/* Confetti emojis */}
            <div className="flex justify-center gap-1 mb-2 text-2xl">
              <span className="animate-bounce" style={{ animationDelay: "0s" }}>
                🎉
              </span>
              <span
                className="animate-bounce"
                style={{ animationDelay: "0.2s" }}
              >
                🏆
              </span>
              <span
                className="animate-bounce"
                style={{ animationDelay: "0.4s" }}
              >
                🎉
              </span>
            </div>
            <h1 className="text-white font-extrabold text-4xl sm:text-5xl tracking-wider drop-shadow-lg mb-3">
              BINGO!
            </h1>

            {/* Winner names */}
            <div className="space-y-1.5">
              {winnerNames.slice(0, 3).map((name, idx) => (
                <div
                  key={`${name}-${idx}`}
                  className="flex items-center justify-center gap-2"
                >
                  <div className="bg-green-500/30 backdrop-blur border border-green-400/40 rounded-xl px-3 py-1.5 text-white font-bold text-sm max-w-[180px] truncate shadow-lg">
                    {idx === 0 ? "👑 " : ""}
                    {name}
                  </div>
                  {idx === 0 && (
                    <span className="text-white/90 text-sm font-semibold">
                      won the game!
                    </span>
                  )}
                </div>
              ))}
              {winnerNames.length > 3 && (
                <p className="text-white/70 text-sm font-medium mt-1">
                  +{winnerNames.length - 3} more winner
                  {winnerNames.length - 3 > 1 ? "s" : ""}
                </p>
              )}
            </div>

            {/* Current user indicator */}
            {isCurrentUserWinner && (
              <div className="mt-3 bg-white/20 backdrop-blur rounded-full px-4 py-1.5 inline-block">
                <span className="text-white text-sm font-bold">
                  🎉 That's you!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Winning Cards */}
        {displayWinners.length > 0 && (
          <div
            className={`${isMultiCartelas ? "max-h-[50vh] overflow-y-auto" : ""} space-y-4 mb-4`}
          >
            {displayWinners.map((w, idx) => {
              const cardData = cardDataFromWinner(w);
              const calledNumbers = calledNumbersForWinner(w, gameCalled);
              const boardNumber = w.cartelaNumber || w.cardId || "N/A";
              const label = getWinnerDisplayName(w);

              return (
                <div
                  key={`${String(w.userId)}-${boardNumber}-${idx}`}
                  className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4"
                >
                  {isMultiCartelas && (
                    <div className="text-center mb-3">
                      <span className="text-white/80 text-sm font-bold">
                        {label}
                      </span>
                      <span className="text-white/40 text-xs ml-2">
                        Board #{boardNumber}
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
                        showHeader={true}
                      />
                    ) : (
                      <div className="bg-white/10 rounded-xl p-6 text-center">
                        <div className="text-3xl mb-2">🏆</div>
                        <p className="text-white/60 text-sm">
                          Cartella #{boardNumber}
                        </p>
                        <p className="text-white/30 text-xs mt-1">
                          Preview unavailable
                        </p>
                      </div>
                    )}
                  </div>
                  {!isMultiCartelas && (
                    <p className="text-center text-white/40 text-xs mt-2">
                      Board #{boardNumber}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Countdown */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl py-5 px-4 shadow-xl shadow-orange-500/20 text-center">
          <p className="text-white/80 text-sm font-medium mb-1">
            አዲስ ጭዋታ ለመጀመር
          </p>
          <div className="text-white font-extrabold text-5xl tracking-wider drop-shadow-lg">
            {countdown > 0 ? countdown : "0"}
          </div>
          <p className="text-white/70 text-xs mt-1">
            {countdown > 0 ? `Next game in ${countdown}s` : "Loading..."}
          </p>
        </div>
      </div>
    </div>
  );
}
