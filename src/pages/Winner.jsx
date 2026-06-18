import React, { useEffect, useState, useRef } from "react";
import { useWebSocket } from "../contexts/WebSocketContext";
import { useAuth } from "../lib/auth/AuthProvider";
import CartellaCard from "../components/CartellaCard";
import { FaTrophy, FaCrown, FaClock } from "react-icons/fa";
import { GiConfirmed, GiTrophyCup } from "react-icons/gi";
import { playBingoSound } from "../lib/audio/numberSounds";

export default function Winner({ onNavigate, onResetToGame }) {
  const { gameState } = useWebSocket();
  const { sessionId } = useAuth();
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    console.log("🎯 Winner component - Full gameState:", {
      phase: gameState.phase,
      winners: gameState.winners,
      winnersCount: gameState.winners?.length,
      calledNumbers: gameState.calledNumbers?.length,
    });
  }, [gameState.winners, gameState.phase, gameState.calledNumbers]);

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
  const hasWinners = winners.length > 0;

  // Play the celebratory bingo sound once when the game completes with a winner,
  // unless the player has muted sound (shared toggle stored by GameLayout).
  const bingoSoundPlayedRef = useRef(false);
  useEffect(() => {
    if (bingoSoundPlayedRef.current || !hasWinners) return;
    let soundOn = true;
    try {
      const saved = localStorage.getItem("lekulu_sound_enabled");
      soundOn = saved !== null ? saved === "true" : true;
    } catch {
      soundOn = true;
    }
    if (soundOn) {
      bingoSoundPlayedRef.current = true;
      playBingoSound().catch(() => {});
    }
  }, [hasWinners]);

  const isCurrentUserWinner =
    sessionId &&
    winners.some(
      (w) =>
        w.userId === sessionId ||
        w.sessionId === sessionId ||
        (w.user && w.user.id && w.user.id.toString() === sessionId?.toString()),
    );

  // No winner state
  if (!hasWinners) {
    return (
      <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-6 text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/20 flex items-center justify-center">
              <GiTrophyCup className="text-amber-400" size={28} />
            </div>
            <h1 className="text-white font-bold text-2xl mb-2">Game Over</h1>
            <p className="text-white/40 text-sm">No winners this round</p>
          </div>

          <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] py-5 px-4 text-center">
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[var(--app-height)] bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)]">
      <div className="max-w-md mx-auto px-4 py-6 pb-24">
        {/* Winner Banner */}
        <div className="bg-gradient-to-b from-amber-400/15 to-white/[0.02] backdrop-blur-xl border border-amber-400/40 rounded-2xl p-5 text-center mb-4 shadow-[0_0_40px_rgba(245,158,11,0.18)]">
          <div className="flex justify-center gap-2 mb-3">
            <span className="text-2xl">🎉</span>
            <span className="text-2xl">🏆</span>
            <span className="text-2xl">🎊</span>
          </div>

          <div className="flex items-center justify-center gap-2 mb-3">
            <FaTrophy className="text-amber-400" size={24} />
            <h1 className="font-black text-3xl tracking-wider bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)]">
              BINGO!
            </h1>
          </div>

          {/* Winner names - Show ALL winners */}
          <div className="space-y-2">
            {winners.map((winner, idx) => (
              <div
                key={`${winner.userId}-${idx}`}
                className="flex items-center justify-center gap-2 flex-wrap"
              >
                <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-full px-3 py-1 text-emerald-200 font-bold text-sm">
                  {idx === 0 && (
                    <FaCrown className="inline mr-1 text-amber-400" size={12} />
                  )}
                  {winner.name || `Cartella #${winner.cartelaNumber}`}
                </div>
                {winner.prize && (
                  <span className="text-amber-400 text-xs font-medium">
                    won {winner.prize} ETB
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Current user won badge */}
          {isCurrentUserWinner && (
            <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30">
              <GiConfirmed size={12} className="text-emerald-400" />
              <span className="text-emerald-400 text-xs font-bold">
                You won!
              </span>
            </div>
          )}
        </div>

        {/* Winning Cards */}
        <div className="space-y-3 mb-4 max-h-[50vh] overflow-y-auto">
          {winners.map((winner, idx) => {
            const cardData = winner.card;
            const calledNumbers =
              winner.called || gameState.calledNumbers || [];
            const boardNumber = winner.cartelaNumber;
            const prize = winner.prize || 0;

            return (
              <div
                key={`${winner.userId}-${boardNumber}-${idx}`}
                className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.3)] p-3"
              >
                <div className="flex items-center justify-between mb-2 px-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-sm font-bold">
                      Cartella #{boardNumber}
                    </span>
                    <span className="text-emerald-400 text-xs font-medium">
                      Won {prize} ETB
                    </span>
                  </div>
                  <span className="text-white/40 text-xs">
                    {winner.name || "Player"}
                  </span>
                </div>
                <div className="flex justify-center">
                  {cardData &&
                  Array.isArray(cardData) &&
                  cardData.length === 5 ? (
                    <CartellaCard
                      id={boardNumber}
                      card={cardData}
                      called={calledNumbers}
                      isPreview={false}
                      showWinningPattern={true}
                      showHeader={false}
                      size="small"
                    />
                  ) : (
                    <div className="bg-white/5 rounded-xl p-4 text-center w-full">
                      <div className="text-2xl mb-1">🏆</div>
                      <p className="text-white/40 text-sm">
                        Cartella #{boardNumber}
                      </p>
                      <p className="text-emerald-400 text-xs font-bold mt-1">
                        Won {prize} ETB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Countdown */}
        <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_6px_24px_rgba(0,0,0,0.3)] py-4 px-4 text-center">
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
        </div>
      </div>
    </div>
  );
}
