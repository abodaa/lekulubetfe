import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useAuth } from "../lib/auth/AuthProvider";

const WebSocketContext = createContext();

export function WebSocketProvider({ children }) {
  const { sessionId } = useAuth();
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const safeSessionId = sessionId;
  const [gameState, setGameState] = useState({
    phase: "waiting",
    gameId: null,
    playersCount: 0,
    prizePool: 0,
    calledNumbers: [],
    currentNumber: null,
    takenCards: [],
    yourSelections: [],
    yourCards: [],
    countdown: 0,
    registrationEndTime: null,
    winners: [],
    walletUpdate: null,
    nextRegistrationStart: null,
    totalCartellas: 200,
  });
  const [lastEvent, setLastEvent] = useState(null);
  const [currentStake, setCurrentStake] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [pendingGameStart, setPendingGameStart] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const rejoinScheduledRef = useRef(false);
  const connectionAttemptRef = useRef(false);

  // Batch updates for performance
  const pendingUpdatesRef = useRef([]);
  const batchTimerRef = useRef(null);
  const batchUpdateGameState = useCallback((updater) => {
    pendingUpdatesRef.current.push(updater);
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(() => {
      const updates = pendingUpdatesRef.current;
      pendingUpdatesRef.current = [];
      setGameState((prev) => {
        let newState = prev;
        for (const update of updates) {
          newState = { ...newState, ...update };
        }
        return newState;
      });
    }, 16);
  }, []);

  const send = useCallback(
    (type, payload) => {
      const ws = wsRef.current;
      const message = JSON.stringify({ type, payload });
      console.log("WebSocket send:", {
        type,
        payload,
        connected,
        readyState: ws?.readyState,
      });

      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
          console.log("Message sent successfully:", { type, payload });
          return true;
        } catch (error) {
          console.error("Error sending message:", error);
          return false;
        }
      } else {
        console.warn("WebSocket not ready, message not sent:", {
          type,
          payload,
          readyState: ws?.readyState,
        });
        return false;
      }
    },
    [connected],
  );

  // Countdown timer effect
  useEffect(() => {
    let intervalId = null;

    if (gameState.phase === "registration" && gameState.registrationEndTime) {
      intervalId = setInterval(() => {
        const now = Date.now();
        const endTime = gameState.registrationEndTime;
        const remainingSeconds = Math.max(0, Math.ceil((endTime - now) / 1000));

        batchUpdateGameState(() => ({
          countdown: remainingSeconds,
        }));

        if (remainingSeconds <= 0) {
          clearInterval(intervalId);
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [gameState.phase, gameState.registrationEndTime, batchUpdateGameState]);

  const connectGeneral = useCallback(() => {
    console.log("🔍 WebSocket connectGeneral called:", {
      safeSessionId: safeSessionId ? "PRESENT" : "MISSING",
      sessionIdLength: safeSessionId?.length || 0,
      timestamp: new Date().toISOString(),
    });

    if (!safeSessionId) {
      console.log(
        "❌ WebSocket general connection skipped - missing sessionId",
      );
      return;
    }

    if (connected && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("Already connected to general WebSocket");
      return;
    }

    if (isConnecting || connectionAttemptRef.current) {
      console.log("General connection already in progress, skipping");
      return;
    }

    connectionAttemptRef.current = true;

    if (wsRef.current) {
      console.log("Closing existing connection for general connection");
      wsRef.current.close();
      wsRef.current = null;
      setConnected(false);
    }

    console.log("Connecting to general WebSocket");

    let stopped = false;
    let connecting = false;
    let retry = 0;
    let heartbeat = null;

    const connect = () => {
      if (connecting || stopped) {
        console.log(
          "General WebSocket connection skipped - already connecting or stopped",
        );
        return;
      }

      connecting = true;
      setIsConnecting(true);

      let wsBase =
        import.meta.env.VITE_WS_URL ||
        (window.location.hostname === "localhost"
          ? "ws://localhost:3001"
          : "wss://lekulubingoback.onrender.com");
      wsBase = (wsBase || "").replace(/\/+$/, "");
      if (!/\/ws$/i.test(wsBase)) {
        wsBase += "/ws";
      }
      const wsUrl = `${wsBase}?token=${safeSessionId}`;
      console.log("Connecting to general WebSocket:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ General WebSocket connected successfully");
        setConnected(true);
        setIsConnecting(false);
        connecting = false;
        connectionAttemptRef.current = false;
        retry = 0;

        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        if (currentStake) {
          try {
            console.log("Joining room after connect:", { stake: currentStake });
            ws.send(
              JSON.stringify({
                type: "join_room",
                payload: { stake: currentStake },
              }),
            );
          } catch (e) {
            console.warn("Failed to send join_room on open", e);
          }
        }
      };

      ws.onmessage = (e) => {
        try {
          setMessageCount((prev) => prev + 1);
          console.log("WS message received:", e.data);
          const event = JSON.parse(e.data);
          setLastEvent(event);

          if (
            ["game_finished", "registration_open", "game_started"].includes(
              event.type,
            )
          ) {
            console.log(`🔥 CRITICAL EVENT: ${event.type}`, {
              phase: event.payload?.phase || "unknown",
              gameId: event.payload?.gameId,
              playersCount: event.payload?.playersCount,
              timestamp: new Date().toISOString(),
            });
          }

          switch (event.type) {
            case "pong":
              break;

            case "general_update":
              batchUpdateGameState(() => event.payload);
              break;

            case "snapshot": {
              batchUpdateGameState((prev) => {
                const snapshotPhase = event.payload.phase || "waiting";
                const snapshotGameId = event.payload.gameId;

                const isCurrentlyRunning = prev.phase === "running";
                const hasCards =
                  Array.isArray(prev.yourCards) && prev.yourCards.length > 0;
                const isSameGame = prev.gameId === snapshotGameId;

                if (isCurrentlyRunning && hasCards && !isSameGame) {
                  return prev;
                }

                const phase = snapshotPhase;
                const gameId = snapshotGameId;

                const registrationEndTime =
                  event.payload.nextStartAt ||
                  event.payload.registrationEndTime;

                const serverCountdown =
                  event.payload.countdownSeconds != null
                    ? event.payload.countdownSeconds
                    : registrationEndTime
                      ? Math.max(
                          0,
                          Math.ceil((registrationEndTime - Date.now()) / 1000),
                        )
                      : 0;

                const shouldPreserveCards =
                  phase === "running" &&
                  isSameGame &&
                  hasCards &&
                  (!event.payload.cards || event.payload.cards.length === 0);

                const snapshotCards = event.payload.cards;
                const snapshotSelections = event.payload.yourSelections;

                let finalCards = prev.yourCards || [];
                let finalSelections = prev.yourSelections || [];

                if (phase === "running") {
                  if (snapshotCards && snapshotCards.length > 0) {
                    finalCards = snapshotCards;
                  } else if (shouldPreserveCards) {
                    finalCards = prev.yourCards || [];
                  } else {
                    finalCards = [];
                  }
                  if (snapshotSelections && snapshotSelections.length > 0) {
                    finalSelections = snapshotSelections;
                  } else if (shouldPreserveCards) {
                    finalSelections = prev.yourSelections || [];
                  }
                }

                return {
                  ...prev,
                  playersCount:
                    event.payload.playersCount ?? prev.playersCount ?? 0,
                  prizePool: event.payload.prizePool ?? prev.prizePool ?? 0,
                  takenCards: event.payload.takenCards || prev.takenCards || [],
                  availableCards:
                    event.payload.availableCards || prev.availableCards || [],
                  phase,
                  gameId,
                  calledNumbers:
                    event.payload.calledNumbers ||
                    event.payload.called ||
                    prev.calledNumbers ||
                    [],
                  countdown: serverCountdown,
                  registrationEndTime,
                  yourCards: phase === "registration" ? [] : finalCards,
                  yourSelections:
                    phase === "registration" ? [] : finalSelections,
                  totalCartellas:
                    event.payload.totalCartellas || prev.totalCartellas || 200,
                  ...(phase === "registration"
                    ? { currentNumber: null, winners: [] }
                    : {}),
                };
              });
              break;
            }

            case "registration_open": {
              const registrationEndTime = event.payload.endsAt;
              const serverCountdown =
                event.payload.countdownSeconds != null
                  ? event.payload.countdownSeconds
                  : registrationEndTime
                    ? Math.max(
                        0,
                        Math.ceil((registrationEndTime - Date.now()) / 1000),
                      )
                    : 0;
              batchUpdateGameState(() => ({
                phase: "registration",
                gameId: event.payload.gameId,
                playersCount: event.payload.playersCount || 0,
                countdown: serverCountdown,
                registrationEndTime,
                yourCards: [],
                yourSelections: [],
                calledNumbers: [],
                currentNumber: null,
                winners: [],
                takenCards: event.payload.takenCards || [],
                availableCards: event.payload.availableCards || [],
                prizePool: 0,
                totalCartellas: event.payload.totalCartellas || 200,
              }));
              break;
            }

            case "registration_extended": {
              const registrationEndTime = event.payload.endsAt;
              const serverCountdown =
                event.payload.countdownSeconds != null
                  ? event.payload.countdownSeconds
                  : registrationEndTime
                    ? Math.max(
                        0,
                        Math.ceil((registrationEndTime - Date.now()) / 1000),
                      )
                    : 0;
              batchUpdateGameState(() => ({
                phase: "registration",
                gameId: event.payload.gameId || gameState.gameId,
                playersCount:
                  event.payload.playersCount ?? gameState.playersCount ?? 0,
                countdown: serverCountdown,
                registrationEndTime,
                takenCards:
                  event.payload.takenCards || gameState.takenCards || [],
                prizePool: event.payload.prizePool ?? gameState.prizePool ?? 0,
              }));
              break;
            }

            case "registration_closed": {
              batchUpdateGameState(() => ({
                phase: "starting",
                gameId: event.payload?.gameId || gameState.gameId,
                countdown: 0,
              }));
              break;
            }

            case "game_started":
              batchUpdateGameState((prev) => {
                if (
                  prev.phase === "running" &&
                  Array.isArray(prev.yourCards) &&
                  prev.yourCards.length > 0 &&
                  prev.gameId !== event.payload.gameId
                ) {
                  return prev;
                }
                const cards = event.payload.cards || [];
                const cardNumbers = cards
                  .map((card) => card.cardNumber || card)
                  .filter((num) => num != null);
                return {
                  ...prev,
                  phase: "running",
                  gameId: event.payload.gameId,
                  playersCount: event.payload.playersCount,
                  prizePool: event.payload.prizePool,
                  calledNumbers:
                    event.payload.calledNumbers || event.payload.called || [],
                  yourCards: cards,
                  yourSelections: cardNumbers,
                };
              });
              setPendingGameStart(null);
              break;

            case "number_called":
              batchUpdateGameState((prev) => {
                if (
                  event.payload.gameId &&
                  event.payload.gameId !== prev.gameId
                )
                  return prev;
                return {
                  ...prev,
                  currentNumber: event.payload.number,
                  calledNumbers:
                    event.payload.calledNumbers || event.payload.called || [],
                };
              });
              break;

            case "players_update":
              batchUpdateGameState((prev) => {
                if (
                  event.payload?.gameId &&
                  event.payload.gameId !== prev.gameId
                )
                  return prev;
                return {
                  ...prev,
                  playersCount: event.payload.playersCount,
                  prizePool: event.payload.prizePool,
                };
              });
              break;

            case "registration_update":
              batchUpdateGameState((prev) => {
                if (
                  event.payload?.gameId &&
                  event.payload.gameId !== prev.gameId
                )
                  return prev;
                return {
                  ...prev,
                  takenCards: event.payload.takenCards || [],
                  prizePool: event.payload.prizePool,
                };
              });
              break;

            case "selection_confirmed":
              batchUpdateGameState((prev) => {
                if (
                  event.payload?.gameId &&
                  event.payload.gameId !== prev.gameId
                )
                  return prev;
                return {
                  ...prev,
                  yourSelections:
                    event.payload.selections || prev.yourSelections || [],
                  playersCount: event.payload.playersCount,
                  prizePool: event.payload.prizePool,
                };
              });
              break;

            case "card_selected":
            case "select_card":
              batchUpdateGameState(() => ({
                yourSelections:
                  event.payload.selections || gameState.yourSelections || [],
                takenCards: event.payload.takenCards || gameState.takenCards,
                playersCount:
                  event.payload.playersCount || gameState.playersCount,
              }));
              break;

            case "selection_cleared":
              batchUpdateGameState(() => ({
                yourSelections: event.payload.selections || [],
                playersCount:
                  event.payload.playersCount ?? gameState.playersCount,
                prizePool: event.payload.prizePool ?? gameState.prizePool,
              }));
              break;

            case "bingo_accepted":
              batchUpdateGameState(() => ({
                winners: event.payload.winners || [],
              }));
              break;

            case "bingo_rejected":
              window.dispatchEvent(
                new CustomEvent("bingoRejected", {
                  detail: event.payload || {},
                }),
              );
              break;

            case "game_finished":
            case "game_ended":
              batchUpdateGameState((prev) => {
                if (
                  event.payload?.gameId &&
                  prev.gameId &&
                  event.payload.gameId !== prev.gameId
                )
                  return prev;
                return {
                  ...prev,
                  phase: "announce",
                  gameId: event.payload?.gameId || prev.gameId,
                  winners:
                    (event.payload &&
                      (event.payload.winners || event.payload.winner || [])) ||
                    prev.winners ||
                    [],
                  calledNumbers:
                    (event.payload &&
                      (event.payload.calledNumbers || event.payload.called)) ||
                    prev.calledNumbers,
                  currentNumber: null,
                  yourCards: [],
                  yourSelections: [],
                  nextRegistrationStart: event.payload?.nextStartAt || null,
                };
              });
              break;

            case "wallet_update":
              batchUpdateGameState(() => ({
                walletUpdate: {
                  main: event.payload.main,
                  play: event.payload.play,
                  coins: event.payload.coins,
                  source: event.payload.source,
                },
              }));
              window.dispatchEvent(
                new CustomEvent("walletUpdate", { detail: event }),
              );
              break;

            default:
              console.log("Unhandled WS event:", event.type);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log("General WebSocket closed:", event.code, event.reason);
        setConnected(false);
        setIsConnecting(false);
        connecting = false;
        connectionAttemptRef.current = false;

        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }

        if (!stopped && retry < 5) {
          const delay = Math.min(1000 * Math.pow(2, retry), 30000);
          console.log(
            `Reconnecting general WebSocket in ${delay}ms (attempt ${retry + 1})`,
          );
          setTimeout(() => {
            retry++;
            connectionAttemptRef.current = false;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ General WebSocket error:", error);
        setIsConnecting(false);
        connecting = false;
        connectionAttemptRef.current = false;
      };
    };

    connect();

    return () => {
      stopped = true;
      connectionAttemptRef.current = false;
      if (heartbeat) clearInterval(heartbeat);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    safeSessionId,
    connected,
    isConnecting,
    currentStake,
    gameState,
    batchUpdateGameState,
  ]);

  const connectToStake = useCallback(
    (stake) => {
      if (!safeSessionId || !stake) return;
      const isSameStake = currentStake === stake;

      if (!isSameStake) {
        setGameState({
          phase: "waiting",
          gameId: null,
          playersCount: 0,
          prizePool: 0,
          calledNumbers: [],
          currentNumber: null,
          takenCards: [],
          yourSelections: [],
          yourCards: [],
          countdown: 0,
          registrationEndTime: null,
          winners: [],
          walletUpdate: null,
          nextRegistrationStart: null,
          totalCartellas: 200,
        });
        setCurrentStake(stake);
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "join_room", payload: { stake } }));
        } catch (e) {}
      }
    },
    [safeSessionId, currentStake],
  );

  const forceReconnect = useCallback(
    (stake) => {
      console.log("🔄 Force reconnecting...");
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
      setConnected(false);
      connectionAttemptRef.current = false;
      if (stake) {
        connectToStake(stake);
      } else {
        connectGeneral();
      }
    },
    [connectToStake, connectGeneral],
  );

  const requestNumberResume = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && currentStake) {
      console.log("🎯 Requesting number drawing to resume...");
      ws.send(
        JSON.stringify({ type: "join_room", payload: { stake: currentStake } }),
      );
      ws.send(JSON.stringify({ type: "ping" }));
    }
  }, [currentStake]);

  // ========== NETWORK RECOVERY WITH HTTP STATE RECOVERY ==========
  const recoverGameStateFromHTTP = useCallback(async () => {
    if (!currentStake || !safeSessionId) return false;

    try {
      const apiBase =
        import.meta.env.VITE_API_URL ||
        (window.location.hostname === "localhost"
          ? "http://localhost:3001"
          : "https://lekulubingoback.onrender.com");

      const response = await fetch(
        `${apiBase}/api/games/${currentStake}/status`,
      );
      const data = await response.json();

      if (data.success && data.game && data.game.calledNumbers) {
        console.log(
          "🔄 Recovered game state from HTTP:",
          data.game.calledNumbers.length,
          "numbers",
        );

        batchUpdateGameState(() => ({
          calledNumbers: data.game.calledNumbers || [],
          currentNumber: data.game.lastCalledNumber || gameState.currentNumber,
          phase: data.game.status === "running" ? "running" : gameState.phase,
          gameId: data.game.gameId || gameState.gameId,
          playersCount: data.game.playersCount || gameState.playersCount,
        }));

        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to recover game state:", error);
      return false;
    }
  }, [currentStake, safeSessionId, gameState, batchUpdateGameState]);

  // Auto-reconnect with state recovery
  useEffect(() => {
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let isReconnecting = false;
    let healthInterval = null;

    const attemptReconnect = async () => {
      if (isReconnecting) return;
      isReconnecting = true;

      console.log(`🔄 Reconnect attempt ${reconnectAttempts + 1}...`);

      // Force reconnect
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
      setConnected(false);
      connectionAttemptRef.current = false;

      // Reconnect
      connectGeneral();

      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Re-join room
      if (currentStake && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "join_room",
            payload: { stake: currentStake },
          }),
        );
      }

      // Recover game state from HTTP API
      const recovered = await recoverGameStateFromHTTP();

      if (recovered) {
        console.log("✅ Game state recovered successfully");
        reconnectAttempts = 0;
      } else if (reconnectAttempts < 5) {
        reconnectAttempts++;
        reconnectTimer = setTimeout(attemptReconnect, 3000);
      }

      isReconnecting = false;
    };

    const handleOnline = () => {
      console.log("🌐 Network recovered - reconnecting...");
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectAttempts = 0;
      attemptReconnect();
    };

    const handleOffline = () => {
      console.log("⚠️ Network lost");
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Periodic health check
    healthInterval = setInterval(() => {
      if (navigator.onLine && !connected && currentStake && !isReconnecting) {
        console.log(
          "💓 Health check: connection lost, attempting reconnect...",
        );
        attemptReconnect();
      }
    }, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (healthInterval) clearInterval(healthInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [connected, currentStake, connectGeneral, recoverGameStateFromHTTP]);

  useEffect(() => {
    if (
      sessionId &&
      !connected &&
      !isConnecting &&
      !connectionAttemptRef.current
    ) {
      connectGeneral();
    }
  }, [sessionId, connected, isConnecting, connectGeneral]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Listen for forced game state updates from HTTP API
  useEffect(() => {
    const handleForceUpdate = (event) => {
      if (!event.detail) return;

      console.log("📡 WebSocket context received forced update:", event.detail);

      batchUpdateGameState(() => ({
        calledNumbers: event.detail.calledNumbers || gameState.calledNumbers,
        currentNumber: event.detail.currentNumber || gameState.currentNumber,
        gameId: event.detail.gameId || gameState.gameId,
        phase: event.detail.phase || gameState.phase,
      }));
    };

    window.addEventListener("forceGameStateUpdate", handleForceUpdate);
    return () => {
      window.removeEventListener("forceGameStateUpdate", handleForceUpdate);
    };
  }, [gameState, batchUpdateGameState]);

  const selectCartella = useCallback(
    (cardNumber) => send("select_card", { cardNumber }),
    [send],
  );
  const deselectCartella = useCallback(
    (cardNumber) => send("deselect_card", { cardNumber }),
    [send],
  );
  const claimBingo = useCallback(
    (payload = {}) => send("bingo_claim", payload || {}),
    [send],
  );

  const value = {
    connected,
    gameState,
    lastEvent,
    currentStake,
    connectToStake,
    connectGeneral,
    selectCartella,
    deselectCartella,
    claimBingo,
    send,
    wsReadyState: wsRef.current?.readyState,
    isConnecting:
      isConnecting || wsRef.current?.readyState === WebSocket.CONNECTING,
    messageCount,
    ws: wsRef.current,
    forceReconnect,
    requestNumberResume,
    recoverGameStateFromHTTP,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context)
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  return context;
}
