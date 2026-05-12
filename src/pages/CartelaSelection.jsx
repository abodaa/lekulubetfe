import React, { useState, useEffect, useRef } from "react";
import CartellaCard from "../components/CartellaCard";
import { apiFetch } from "../lib/api/client";
import { useAuth } from "../lib/auth/AuthProvider";
import { useToast } from "../contexts/ToastContext";
import { useWebSocket } from "../contexts/WebSocketContext";

export default function CartelaSelection({
  onNavigate,
  onResetToGame,
  stake,
  onCartelaSelected,
  onGameIdUpdate,
}) {
  const { sessionId } = useAuth();
  const { showError, showSuccess, showWarning } = useToast();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wallet, setWallet] = useState({ main: 0, play: 0 });
  const [walletLoading, setWalletLoading] = useState(true);
  const [alertBanners, setAlertBanners] = useState([]);
  const alertTimersRef = useRef(new Map());

  const {
    connected,
    roomJoined,
    gameState,
    selectCartella,
    deselectCartella,
    connectToStake,
    wsReadyState,
    isConnecting,
    lastEvent,
  } = useWebSocket();
  const hasConnectedRef = useRef(false);
  const rejoinTriedRef = useRef(false);
  const roomCheckTimerRef = useRef(null);

  const totalCartellas = gameState.totalCartellas || cards.length || 200;

  useEffect(() => {
    if (stake && sessionId && !hasConnectedRef.current) {
      hasConnectedRef.current = true;
      connectToStake(stake);
    }
  }, [stake, sessionId, connectToStake]);

  useEffect(() => {
    hasConnectedRef.current = false;
    rejoinTriedRef.current = false;
  }, [stake]);

  useEffect(() => {
    if (!stake || !connected) return;
    if (roomCheckTimerRef.current) clearTimeout(roomCheckTimerRef.current);
    if (gameState.phase === "waiting" && !gameState.gameId) {
      roomCheckTimerRef.current = setTimeout(() => {
        rejoinTriedRef.current = false;
        connectToStake(stake);
      }, 2000);
    }
    return () => {
      if (roomCheckTimerRef.current) clearTimeout(roomCheckTimerRef.current);
    };
  }, [stake, connected, gameState.phase, gameState.gameId, connectToStake]);

  useEffect(() => {
    return () => {
      if (roomCheckTimerRef.current) clearTimeout(roomCheckTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (gameState.phase === "registration") setError(null);
  }, [gameState.phase]);

  useEffect(() => {
    if (gameState.phase === "announce" || gameState.winners?.length > 0) {
      setError(null);
      if (stake && sessionId) connectToStake(stake);
    }
  }, [gameState.phase, gameState.winners, stake, sessionId]);

  useEffect(() => {
    if (!stake || !sessionId) return;
    if (!connected || isConnecting) return;
    if (rejoinTriedRef.current) return;
    if (gameState.phase !== "registration") {
      rejoinTriedRef.current = true;
      connectToStake(stake);
    }
  }, [
    stake,
    sessionId,
    connected,
    isConnecting,
    gameState.phase,
    connectToStake,
  ]);

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
    if (gameState.gameId) onGameIdUpdate?.(gameState.gameId);
  }, [gameState.gameId, onGameIdUpdate]);

  useEffect(() => {
    const fetchWallet = async () => {
      if (!sessionId) return;
      try {
        setWalletLoading(true);
        const walletResponse = await apiFetch("/wallet", { sessionId });
        const mainValue =
          walletResponse.main !== null && walletResponse.main !== undefined
            ? walletResponse.main
            : (walletResponse.balance ?? 0);
        const playValue =
          walletResponse.play !== null && walletResponse.play !== undefined
            ? walletResponse.play
            : 0;
        setWallet({ main: mainValue, play: playValue });
      } catch (walletErr) {
        try {
          const profileResponse = await apiFetch("/user/profile", {
            sessionId,
          });
          if (profileResponse.wallet) {
            setWallet({
              main:
                profileResponse.wallet.main ??
                profileResponse.wallet.balance ??
                0,
              play:
                profileResponse.wallet.play ??
                profileResponse.wallet.balance ??
                0,
            });
          } else {
            setWallet({ main: 0, play: 0 });
          }
        } catch (profileErr) {
          setWallet({ main: 0, play: 0 });
        }
      } finally {
        setWalletLoading(false);
      }
    };
    fetchWallet();
  }, [sessionId]);

  useEffect(() => {
    if (!gameState?.walletUpdate) return;
    const update = gameState.walletUpdate;
    setWallet((prev) => ({
      main: update.main ?? prev.main ?? 0,
      play: update.play ?? prev.play ?? 0,
    }));
  }, [gameState.walletUpdate]);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchCards = async () => {
      if (!sessionId) return;
      try {
        setLoading(true);
        setError(null);
        const response = await apiFetch("/api/cartellas", { sessionId });
        if (response.success && Array.isArray(response.cards)) {
          setCards(response.cards);
          setError(null);
        } else {
          setError("Failed to load cards");
        }
      } catch (err) {
        setError("Failed to load cards from server");
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, [sessionId, retryCount]);

  useEffect(() => {
    const selectedNumbers = Array.isArray(gameState.yourSelections)
      ? gameState.yourSelections
      : [];
    const hasCards =
      Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0;
    const isGameRunning = gameState.phase === "running" && gameState.gameId;
    const isGameStarting = gameState.phase === "starting" && gameState.gameId;
    const hasPlayers =
      typeof gameState.playersCount === "number" && gameState.playersCount >= 2;
    const shouldGoToGameLayout =
      (isGameRunning || isGameStarting) && hasPlayers;

    if (shouldGoToGameLayout) {
      onGameIdUpdate?.(gameState.gameId);
      let cardNumbersToPass = [];
      if (hasCards && Array.isArray(gameState.yourCards)) {
        cardNumbersToPass = gameState.yourCards
          .map((card) => card.cardNumber || card)
          .filter((num) => num != null);
      } else if (selectedNumbers.length > 0) {
        cardNumbersToPass = selectedNumbers;
      }
      onCartelaSelected?.(cardNumbersToPass);
      onNavigate?.("game-layout", true);
    }
  }, [
    gameState.phase,
    gameState.gameId,
    gameState.yourSelections,
    gameState.yourCards,
  ]);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "game_cancelled") showWarning("Not Enough Player");
    if (
      lastEvent.type === "selection_rejected" &&
      lastEvent.payload?.reason === "LIMIT_REACHED"
    )
      showError("You can select only 1 cartela.");
  }, [lastEvent]);

  useEffect(() => {
    const hasSelection =
      Array.isArray(gameState?.yourSelections) &&
      gameState.yourSelections.length > 0;
    const countdownZero =
      typeof gameState?.countdown === "number" && gameState.countdown <= 0;
    const registrationExpired =
      gameState?.phase === "registration" && countdownZero && !hasSelection;
    const msg =
      "Registration time has ended due to low number of players. Please wait for the next game to start.";
    setAlertBanners((prev) => {
      if (registrationExpired && !prev.includes(msg)) return [...prev, msg];
      if (!registrationExpired && prev.includes(msg))
        return prev.filter((m) => m !== msg);
      return prev;
    });
  }, [gameState?.phase, gameState?.countdown, gameState?.yourSelections]);

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

  const handleCardSelect = async (cardNumber) => {
    const cardNum = Number(cardNumber);

    if (walletLoading) {
      showError("Loading wallet information. Please wait a moment.");
      return;
    }

    const selectedNumbers = Array.isArray(gameState.yourSelections)
      ? gameState.yourSelections
      : [];
    const maxCartellas = 5; // Maximum allowed

    // Check if game is in registration phase
    if (gameState.phase !== "registration") {
      const waitMsg =
        "Please wait until the current game finishes. You can select cartella when registration starts again.";
      setAlertBanners((prev) =>
        prev.includes(waitMsg) ? prev : [...prev, waitMsg],
      );
      showError(waitMsg);
      return;
    }

    // Check WebSocket connection
    if (!connected || wsReadyState !== WebSocket.OPEN) {
      showError("Not connected to game server. Please refresh and try again.");
      return;
    }
    // Check if room is joined
    if (!roomJoined) {
      showError("Connecting to game room. Please wait...");
      return;
    }
    // Check if already selected this card
    if (selectedNumbers.includes(cardNum)) {
      showError(`Cartella #${cardNum} already selected`);
      return;
    }

    // Check if max cartellas reached
    if (selectedNumbers.length >= maxCartellas) {
      showError(`Maximum ${maxCartellas} cartellas per game reached`);
      return;
    }

    // Check if card is taken by other players
    const isTakenByOthers = gameState.takenCards.some(
      (taken) => Number(taken) === cardNum,
    );
    if (isTakenByOthers) {
      setAlertBanners((prev) =>
        prev.includes("This cartella is already taken")
          ? prev
          : [...prev, "This cartella is already taken."],
      );
      showError("This cartella is already taken.");
      return;
    }

    // Check if user has enough balance for ALL cartellas (current + new)
    const totalBalance = (wallet.main || 0) + (wallet.play || 0);
    const newTotalCount = selectedNumbers.length + 1;
    const totalNeeded = newTotalCount * Number(stake);

    if (totalBalance < totalNeeded) {
      const msg = `Insufficient balance. Need ${totalNeeded} ETB for ${newTotalCount} cartella(s). You have ${totalBalance.toLocaleString()} ETB.`;
      setAlertBanners((prev) => [...prev, msg]);
      showError(msg);
      return;
    }

    // Select the cartella
    try {
      selectCartella(cardNum);
      // console.log("📤 Called selectCartella for card:", cardNum);
      // console.log("📤 Current selections before:", selectedNumbers);
      showSuccess(
        `Cartella #${cardNum} added! (${selectedNumbers.length + 1}/${maxCartellas})`,
      );
      // console.log("📤 Called selectCartella for card:", cardNum);
      // console.log("📤 Current selections before:", selectedNumbers);
    } catch (err) {
      showError("Failed to select cartella.");
    }
    console.log("📤 Called selectCartella for card:", cardNum);
    console.log("📤 Current selections before:", selectedNumbers);
  };

  const handleRemoveCartella = async (cardNumber) => {
    const cardNum = Number(cardNumber);
    const selectedNumbers = Array.isArray(gameState.yourSelections)
      ? gameState.yourSelections
      : [];

    if (!selectedNumbers.includes(cardNum)) {
      showError(`Cartella #${cardNum} not selected`);
      return;
    }

    if (gameState.phase !== "registration") {
      showError("Cannot remove cartella after game has started");
      return;
    }

    try {
      deselectCartella(cardNum);
      showSuccess(`Cartella #${cardNum} removed`);
    } catch (err) {
      showError("Failed to remove cartella.");
    }
  };

  const timerSeconds =
    gameState.phase === "registration"
      ? gameState.countdown || 0
      : gameState.phase === "waiting"
        ? "--"
        : gameState.countdown || 0;

  const selectedNumbers = Array.isArray(gameState.yourSelections)
    ? gameState.yourSelections
    : [];
  const selectedCards = selectedNumbers
    .map((n) => ({ number: n, card: cards[n - 1] }))
    .filter((x) => x.card);
  const cardsReady = Array.isArray(cards) && cards.length > 0;
  const totalBalance = (wallet.main || 0) + (wallet.play || 0);

  // Loading state
  if (loading || !cardsReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/80 text-lg font-medium">
            Loading cartellas...
          </p>
          <p className="text-white/40 text-sm mt-1">Stake: {stake} ETB</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-bold mb-2">
            Connection Error
          </h2>
          <p className="text-white/60 mb-6">{error}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/20 transition-all"
          >
            🔄 Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex flex-col">
      {/* Alert Banners */}
      {alertBanners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
          {alertBanners.map((msg, i) => (
            <div
              key={i}
              className="bg-gray-900/90 backdrop-blur border border-gray-700/50 rounded-xl px-4 py-3 text-white text-sm flex items-center gap-3 shadow-lg animate-slide-down"
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

      <div className="max-w-md mx-auto w-full flex flex-col flex-1">
        {/* Header */}
        <header className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            {/* Timer */}
            <div
              className={`px-4 py-2 rounded-xl text-center min-w-[80px] ${
                gameState.phase === "registration"
                  ? "bg-yellow-500/20 border border-yellow-500/30"
                  : "bg-white/5 border border-white/10"
              }`}
            >
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Timer
              </div>
              <div
                className={`text-2xl font-extrabold font-mono ${
                  gameState.phase === "registration"
                    ? "text-yellow-300"
                    : "text-white/60"
                }`}
              >
                {timerSeconds}
              </div>
            </div>

            {/* Status */}
            <div className="text-right">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Status
              </div>
              <div
                className={`text-sm font-bold ${
                  gameState.phase === "registration"
                    ? "text-green-300"
                    : gameState.phase === "waiting"
                      ? "text-yellow-300"
                      : gameState.phase === "running"
                        ? "text-blue-300"
                        : "text-white/60"
                }`}
              >
                {gameState.phase === "registration" && "Registration Open"}
                {gameState.phase === "waiting" && "Waiting for room..."}
                {gameState.phase === "starting" && "Starting..."}
                {gameState.phase === "running" && "Game in progress"}
                {gameState.phase === "announce" && "Game finished"}
              </div>
            </div>
          </div>
        </header>

        {/* Stats Bar */}
        <div className="px-4 pb-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Wallet
              </div>
              <div className="text-white font-bold text-sm">
                {walletLoading ? "..." : totalBalance.toLocaleString()}
              </div>
              {selectedNumbers.length > 0 && (
                <div className="text-[8px] text-yellow-400 mt-1">
                  Need: {(selectedNumbers.length + 1) * stake} for +1
                </div>
              )}
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Stake
              </div>
              <div className="text-white font-bold text-sm">{stake}</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-center">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Players
              </div>
              <div className="text-white font-bold text-sm">
                {gameState.playersCount || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Card Selection Grid */}
        <main className="flex-1 px-4 pb-4 overflow-y-auto">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white/80 text-sm font-semibold">
                Select Your Cartella
              </h3>
              <span className="text-white/40 text-xs">
                {totalCartellas} cards
              </span>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4 border border-white/10 max-h-[380px] overflow-y-auto">
              <div className="grid grid-cols-10 gap-1.5">
                {Array.from({ length: totalCartellas }, (_, i) => i + 1).map(
                  (cartelaNumber) => {
                    const cartelaNum = Number(cartelaNumber);
                    const hasCards =
                      Array.isArray(gameState.yourCards) &&
                      gameState.yourCards.length > 0;
                    const shouldShowTakenCards =
                      gameState.phase === "registration" || hasCards;
                    const isTaken = shouldShowTakenCards
                      ? gameState.takenCards.some(
                          (taken) => Number(taken) === cartelaNum,
                        )
                      : false;
                    const isSelected = selectedNumbers.includes(cartelaNum);
                    const takenByMe = isSelected;

                    return (
                      <button
                        key={cartelaNumber}
                        onClick={() => handleCardSelect(cartelaNum)}
                        disabled={
                          gameState.phase !== "registration" || !roomJoined
                        }
                        className={`aspect-square rounded-lg text-xs font-bold transition-all flex items-center justify-center ${
                          isTaken
                            ? takenByMe
                              ? "bg-green-500/30 text-green-300 border-2 border-green-400 scale-105"
                              : "bg-red-500/20 text-red-300/50 border border-red-500/20 cursor-not-allowed"
                            : isSelected
                              ? "bg-green-500/30 text-green-300 border-2 border-green-400 scale-105"
                              : gameState.phase === "registration"
                                ? "bg-white/10 text-white/70 hover:bg-white/20 hover:scale-105 border border-white/10 cursor-pointer"
                                : "bg-white/5 text-white/30 border border-white/5 cursor-not-allowed"
                        }`}
                      >
                        {cartelaNumber}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          {/* Selected Cartellas Grid */}
          {selectedCards.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <h3 className="text-white/80 text-sm font-semibold">
                    Your Cartellas ({selectedCards.length}/5)
                  </h3>
                </div>
                {selectedCards.length > 1 && (
                  <button
                    onClick={() => {
                      if (
                        confirm(`Remove all ${selectedCards.length} cartellas?`)
                      ) {
                        selectedCards.forEach(({ number }) =>
                          deselectCartella(number),
                        );
                      }
                    }}
                    className="text-red-400 text-xs hover:text-red-300"
                  >
                    Remove All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selectedCards.map(({ number, card }) => (
                  <div
                    key={number}
                    className="bg-white/5 backdrop-blur rounded-xl p-2 border border-green-500/20 relative"
                  >
                    <button
                      onClick={() => handleRemoveCartella(number)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors z-10"
                      title="Remove cartella"
                    >
                      ✕
                    </button>
                    <CartellaCard
                      id={number}
                      card={card}
                      called={gameState.calledNumbers || []}
                      isPreview={true}
                      showHeader={false}
                    />
                    <div className="text-center mt-1">
                      <span className="text-white/50 text-xs">#{number}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waiting Message */}
          {gameState.phase !== "registration" &&
            gameState.phase !== "waiting" &&
            !selectedNumbers.length && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-2xl p-4 text-center">
                <div className="text-3xl mb-2">⏳</div>
                <p className="text-yellow-300/80 text-sm font-medium">
                  Game in progress
                </p>
                <p className="text-white/40 text-xs mt-1">
                  Registration will open after this game ends.
                </p>
              </div>
            )}

          {gameState.phase === "waiting" && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-blue-300/80 text-sm font-medium">
                Connecting to room...
              </p>
              <p className="text-white/40 text-xs mt-1">
                Preparing game for stake {stake} ETB
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
