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

    if (gameState.phase !== "registration") {
      const waitMsg =
        "Please wait until the current game finishes. You can select cartela when registration starts again.";
      setAlertBanners((prev) => {
        if (prev.includes(waitMsg)) return prev;
        return [...prev, waitMsg];
      });
      showError(waitMsg);
      return;
    }

    if (!connected || wsReadyState !== WebSocket.OPEN) {
      showError("Not connected to game server. Please refresh and try again.");
      return;
    }

    if (selectedNumbers.includes(cardNum)) {
      try {
        deselectCartella(cardNum);
        showSuccess(`Cartella #${cardNum} deselected!`);
      } catch (err) {
        showError("Failed to deselect cartella.");
      }
      return;
    }

    if (selectedNumbers.length >= 1) {
      const currentCard = selectedNumbers[0];
      if (currentCard === cardNum) return;

      const isTakenByOthers = gameState.takenCards.some(
        (taken) => Number(taken) === cardNum,
      );
      if (isTakenByOthers) {
        const takenMsg =
          "This cartella is already taken. Please choose another.";
        setAlertBanners((prev) =>
          prev.includes(takenMsg) ? prev : [...prev, takenMsg],
        );
        showError(takenMsg);
        return;
      }

      try {
        deselectCartella(currentCard);
        selectCartella(cardNum);
        showSuccess(`Switched to Cartella #${cardNum}!`);
      } catch (err) {
        showError("Failed to switch cartella.");
      }
      return;
    }

    const totalBalance = (wallet.main || 0) + (wallet.play || 0);
    const needed = Number(stake);

    if (totalBalance < needed) {
      const msg = `Insufficient balance. You have ${totalBalance.toLocaleString()} ETB but need ${needed} ETB.`;
      setAlertBanners((prev) => [...prev, msg]);
      showError(msg);
      return;
    }

    const isTakenByOthers = gameState.takenCards.some(
      (taken) => Number(taken) === cardNum,
    );
    if (isTakenByOthers && !selectedNumbers.includes(cardNum)) {
      const takenMsg = "This cartella is already taken. Please choose another.";
      setAlertBanners((prev) => {
        if (prev.includes(takenMsg)) return prev;
        return [...prev, takenMsg];
      });
      showError(takenMsg);
      return;
    }

    try {
      const success = selectCartella(cardNum);
      if (success) {
        showSuccess(
          `Cartella #${cardNum} selected! Waiting for game to start...`,
        );
      } else {
        showError("Failed to select cartella. Please try again.");
      }
    } catch (err) {
      showError("Failed to select cartella. Please try again.");
    }
  };

  const timerSeconds = gameState.countdown || 0;

  const selectedNumbers = Array.isArray(gameState.yourSelections)
    ? gameState.yourSelections
    : [];
  const selectedCards = selectedNumbers
    .map((n) => ({ number: n, card: cards[n - 1] }))
    .filter((x) => x.card);
  const cardsReady = Array.isArray(cards) && cards.length > 0;

  if (loading || !cardsReady) {
    return (
      <div className="app-container joy-bingo-bg">
        <header className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="wallet-box">
                <div className="wallet-label">Wallet</div>
                <div className="wallet-value text-blue-400">
                  {walletLoading
                    ? "..."
                    : (
                        (wallet.main || 0) + (wallet.play || 0)
                      ).toLocaleString()}
                </div>
              </div>
              <div className="wallet-box">
                <div className="wallet-label">Stake</div>
                <div className="wallet-value">{stake}</div>
              </div>
            </div>
            <div className="timer-box">
              <div className="timer-countdown">{timerSeconds}s</div>
              <div className="timer-status">
                {gameState.phase === "registration" &&
                  `Registration open... (${gameState.playersCount} players)`}
                {gameState.phase === "waiting" && "Waiting for room..."}
                {gameState.phase === "starting" && "Starting game..."}
                {gameState.phase === "running" && "Game in progress!"}
                {gameState.phase === "announce" && "Game finished!"}
              </div>
            </div>
          </div>
        </header>
        <main className="p-4 flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-purple-600 font-medium mt-3">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container joy-bingo-bg">
        <header className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="wallet-box">
                <div className="wallet-label">Wallet</div>
                <div className="wallet-value text-blue-400">
                  {walletLoading
                    ? "..."
                    : (
                        (wallet.main || 0) + (wallet.play || 0)
                      ).toLocaleString()}
                </div>
              </div>
              <div className="wallet-box">
                <div className="wallet-label">Stake</div>
                <div className="wallet-value">{stake}</div>
              </div>
            </div>
            <div className="timer-box">
              <div className="timer-countdown">{timerSeconds}s</div>
            </div>
          </div>
        </header>
        <main className="p-4 flex flex-col items-center justify-center min-h-64">
          <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg max-w-md">
            <div className="flex items-center gap-2 text-yellow-400">
              <span className="text-lg">⚠️</span>
              <div>
                <div className="font-semibold">{error}</div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium"
          >
            Retry
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container relative joy-bingo-bg">
      {alertBanners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 px-4 pt-2 space-y-2">
          {alertBanners.map((msg, i) => (
            <div key={i} className="alert-banner-appeal animate-slide-in">
              <div className="alert-icon-wrapper">⚠️</div>
              <div className="alert-message-text">{msg}</div>
              <button
                onClick={() =>
                  setAlertBanners((prev) => prev.filter((_, j) => j !== i))
                }
                className="alert-dismiss-btn"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <header className="p-4 mb-0">
        <div
          className="game-info-bar-light flex items-stretch rounded-lg flex-nowrap"
          style={{ marginBottom: "1rem" }}
        >
          <div className="info-box info-box-timer flex-1 flex items-center justify-center">
            <span className="timer-value">{timerSeconds}s</span>
          </div>
          <div className="info-box flex-1">
            <div className="info-label">Wallet</div>
            <div className="info-value">
              {walletLoading
                ? "..."
                : ((wallet.main || 0) + (wallet.play || 0)).toLocaleString()}
            </div>
          </div>
          <div className="info-box flex-1">
            <div className="info-label">Stake</div>
            <div className="info-value">{stake}</div>
          </div>
          {gameState.phase === "registration" && (
            <div className="info-box flex-1">
              <div className="info-label">Players</div>
              <div className="info-value">{gameState.playersCount || 0}</div>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 mt-2 pb-6 flex flex-col gap-4">
        <div className="mx-4 mb-6">
          <div
            className="cartela-grid-scrollable rounded-lg p-4 max-h-[320px] min-h-[260px] overflow-y-auto"
            style={{ background: "#cfade0" }}
          >
            <div className="cartela-numbers-grid">
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
                  const takenByMe = selectedNumbers.includes(cartelaNum);
                  return (
                    <button
                      key={cartelaNumber}
                      onClick={() => handleCardSelect(cartelaNum)}
                      className={`cartela-number-btn-light ${isTaken ? (takenByMe ? "cartela-selected-light" : "cartela-taken-light") : isSelected ? "cartela-selected-light" : "cartela-normal-light"}`}
                    >
                      {cartelaNumber}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </div>

        {selectedCards.length > 0 &&
          (gameState.phase === "registration" ||
            (Array.isArray(gameState.yourCards) &&
              gameState.yourCards.length > 0)) && (
            <div style={{ marginTop: "40px" }}>
              <div className="rounded-lg p-2">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    width: "100%",
                  }}
                >
                  {selectedCards.slice(0, 1).map(({ number, card }) => (
                    <CartellaCard
                      key={number}
                      id={number}
                      card={card}
                      called={gameState.calledNumbers || []}
                      isPreview={true}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  );
}
