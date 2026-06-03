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
  const [isConnecting, setIsConnecting] = useState(false);
  const connectionAttemptRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const gameEndedRef = useRef(false);
  const isMountedRef = useRef(true);

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
    youWon: false,
    yourPrize: 0,
    walletUpdate: null,
    nextRegistrationStart: null,
    totalCartellas: 200,
  });
  const [lastEvent, setLastEvent] = useState(null);
  const [currentStake, setCurrentStake] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [pendingGameStart, setPendingGameStart] = useState(null);

  const send = useCallback((type, payload) => {
    const ws = wsRef.current;
    const message = JSON.stringify({ type, payload });
    console.log(`📤 WebSocket send: ${type}`, { readyState: ws?.readyState });

    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(message);
        console.log(`✅ Message sent: ${type}`);
        return true;
      } catch (error) {
        console.error(`❌ Error sending ${type}:`, error);
        return false;
      }
    } else {
      console.warn(`⚠️ WebSocket not ready for: ${type}`);
      return false;
    }
  }, []);

  // Countdown timer effect
  useEffect(() => {
    let intervalId = null;

    if (gameState.phase === "registration" && gameState.registrationEndTime) {
      intervalId = setInterval(() => {
        const now = Date.now();
        const endTime = gameState.registrationEndTime;
        const remainingSeconds = Math.max(0, Math.ceil((endTime - now) / 1000));

        setGameState((prev) => ({
          ...prev,
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
  }, [gameState.phase, gameState.registrationEndTime]);

  // Resume game after network recovery
  const resumeGameAfterReconnect = useCallback(async () => {
    if (!currentStake || !safeSessionId || gameEndedRef.current) return false;

    console.log("🔄 Resuming game after network recovery...");

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

      if (
        data.success &&
        data.game &&
        data.game.status === "running" &&
        isMountedRef.current
      ) {
        const serverCalledNumbers = data.game.calledNumbers || [];
        const localCalledNumbers = gameState.calledNumbers || [];

        if (serverCalledNumbers.length > localCalledNumbers.length) {
          const missedNumbers = serverCalledNumbers.slice(
            localCalledNumbers.length,
          );
          console.log(`📢 Recovering ${missedNumbers.length} missed numbers`);

          // Update state with all server numbers at once
          setGameState((prev) => ({
            ...prev,
            calledNumbers: serverCalledNumbers,
            currentNumber: data.game.lastCalledNumber || prev.currentNumber,
            phase: "running",
            gameId: data.game.gameId || prev.gameId,
            playersCount: data.game.playersCount || prev.playersCount,
            prizePool: data.game.totalPrizes || prev.prizePool,
          }));

          // Dispatch event for UI to update marks
          window.dispatchEvent(
            new CustomEvent("numbersRecovered", {
              detail: {
                numbers: missedNumbers,
                allNumbers: serverCalledNumbers,
              },
            }),
          );
        }

        // Re-join room to continue receiving draws
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: "join_room",
              payload: { stake: currentStake },
            }),
          );
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to resume game:", error);
      return false;
    }
  }, [currentStake, safeSessionId, gameState.calledNumbers]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connectGeneral = useCallback(() => {
    if (!safeSessionId) {
      console.log("❌ No sessionId, skipping connection");
      return;
    }

    if (connected && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("✅ Already connected");
      return;
    }

    if (isConnecting || connectionAttemptRef.current) {
      console.log("⚠️ Connection already in progress");
      return;
    }

    connectionAttemptRef.current = true;
    setIsConnecting(true);
    cleanup();

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
    console.log("🔌 Connecting to WebSocket");

    let connectionTimeout = null;
    let retryCount = 0;
    const maxRetries = 5;

    const connect = () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error("❌ WebSocket connection timeout");
          ws.close();
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(connect, 2000 * retryCount);
          } else {
            setIsConnecting(false);
            connectionAttemptRef.current = false;
            setConnected(false);
          }
        }
      }, 10000);

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        clearTimeout(connectionTimeout);
        setConnected(true);
        setIsConnecting(false);
        connectionAttemptRef.current = false;
        retryCount = 0;

        // Resume game after reconnect
        setTimeout(() => {
          if (currentStake && !gameEndedRef.current) {
            resumeGameAfterReconnect();
          }
        }, 500);

        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        if (currentStake && !gameEndedRef.current) {
          ws.send(
            JSON.stringify({
              type: "join_room",
              payload: { stake: currentStake },
            }),
          );
        }
      };

      ws.onmessage = (e) => {
        try {
          setMessageCount((prev) => prev + 1);
          const event = JSON.parse(e.data);
          setLastEvent(event);
          handleWebSocketMessage(event);
        } catch (error) {
          console.error("❌ Error parsing message:", error);
        }
      };

      ws.onclose = (event) => {
        console.log(`🔌 WebSocket closed: ${event.code}`);
        clearTimeout(connectionTimeout);
        setConnected(false);

        if (event.code === 1008) {
          console.error("❌ Auth failed");
          connectionAttemptRef.current = false;
          setIsConnecting(false);
          return;
        }

        if (!gameEndedRef.current && retryCount < maxRetries) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
          console.log(
            `🔄 Reconnecting in ${delay}ms (${retryCount}/${maxRetries})`,
          );
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        } else {
          connectionAttemptRef.current = false;
          setIsConnecting(false);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
        clearTimeout(connectionTimeout);
      };
    };

    connect();

    return () => {
      if (connectionTimeout) clearTimeout(connectionTimeout);
    };
  }, [
    safeSessionId,
    connected,
    isConnecting,
    currentStake,
    cleanup,
    resumeGameAfterReconnect,
  ]);

  const handleWebSocketMessage = useCallback(
    (event) => {
      const { type, payload } = event;

      switch (type) {
        case "pong":
          break;

        case "snapshot":
          setGameState((prev) => {
            const snapshotPhase = payload.phase || "waiting";
            const snapshotGameId = payload.gameId;
            const registrationEndTime =
              payload.nextStartAt || payload.registrationEndTime;
            const serverCountdown =
              payload.countdownSeconds != null
                ? payload.countdownSeconds
                : registrationEndTime
                  ? Math.max(
                      0,
                      Math.ceil((registrationEndTime - Date.now()) / 1000),
                    )
                  : 0;

            const shouldPreserveCards =
              prev.phase === "running" &&
              prev.gameId === snapshotGameId &&
              prev.yourCards?.length > 0;

            let finalCards = prev.yourCards || [];
            let finalSelections = prev.yourSelections || [];

            if (snapshotPhase === "running") {
              if (payload.cards && payload.cards.length > 0) {
                finalCards = payload.cards;
                finalSelections = payload.cards
                  .map((c) => c.cardNumber || c)
                  .filter(Boolean);
              } else if (shouldPreserveCards) {
                finalCards = prev.yourCards || [];
                finalSelections = prev.yourSelections || [];
              }
            } else if (snapshotPhase === "registration") {
              finalCards = [];
              finalSelections = [];
            }

            return {
              ...prev,
              phase: snapshotPhase,
              gameId: snapshotGameId,
              playersCount: payload.playersCount ?? prev.playersCount ?? 0,
              prizePool: payload.prizePool ?? prev.prizePool ?? 0,
              takenCards: payload.takenCards || prev.takenCards || [],
              calledNumbers:
                payload.calledNumbers ||
                payload.called ||
                prev.calledNumbers ||
                [],
              countdown: serverCountdown,
              registrationEndTime,
              yourCards: finalCards,
              yourSelections: finalSelections,
              totalCartellas:
                payload.totalCartellas || prev.totalCartellas || 200,
              ...(snapshotPhase === "registration"
                ? { currentNumber: null, winners: [] }
                : {}),
            };
          });
          break;

        case "registration_open":
          gameEndedRef.current = false;
          const registrationEndTime = payload.endsAt;
          const serverCountdown =
            payload.countdownSeconds != null
              ? payload.countdownSeconds
              : registrationEndTime
                ? Math.max(
                    0,
                    Math.ceil((registrationEndTime - Date.now()) / 1000),
                  )
                : 0;
          setGameState((prev) => ({
            ...prev,
            phase: "registration",
            gameId: payload.gameId,
            playersCount: payload.playersCount || 0,
            countdown: serverCountdown,
            registrationEndTime,
            yourCards: [],
            yourSelections: [],
            calledNumbers: [],
            currentNumber: null,
            winners: [],
            takenCards: payload.takenCards || [],
            prizePool: 0,
            totalCartellas: payload.totalCartellas || 200,
          }));
          break;

        case "registration_extended":
          const extEndTime = payload.endsAt;
          const extCountdown =
            payload.countdownSeconds != null
              ? payload.countdownSeconds
              : extEndTime
                ? Math.max(0, Math.ceil((extEndTime - Date.now()) / 1000))
                : 0;
          setGameState((prev) => ({
            ...prev,
            phase: "registration",
            gameId: payload.gameId || prev.gameId,
            playersCount: payload.playersCount ?? prev.playersCount ?? 0,
            countdown: extCountdown,
            registrationEndTime: extEndTime,
            takenCards: payload.takenCards || prev.takenCards || [],
            prizePool: payload.prizePool ?? prev.prizePool ?? 0,
          }));
          break;

        case "registration_closed":
          setGameState((prev) => ({
            ...prev,
            phase: "starting",
            gameId: payload?.gameId || prev.gameId,
            countdown: 0,
          }));
          break;

        case "game_started":
          setGameState((prev) => {
            if (
              prev.phase === "running" &&
              prev.yourCards?.length > 0 &&
              prev.gameId !== payload.gameId
            ) {
              return prev;
            }
            const cards = payload.cards || [];
            const cardNumbers = cards
              .map((card) => card.cardNumber || card)
              .filter((num) => num != null);
            const newState = {
              ...prev,
              phase: "running",
              gameId: payload.gameId,
              playersCount: payload.playersCount,
              prizePool: payload.prizePool,
              calledNumbers: payload.calledNumbers || payload.called || [],
              yourCards: cards,
              yourSelections: cardNumbers,
              youWon: false,
              yourPrize: 0,
            };
            window.dispatchEvent(
              new CustomEvent("gameStarted", {
                detail: {
                  gameId: newState.gameId,
                  phase: newState.phase,
                  playersCount: newState.playersCount,
                  hasCards: newState.yourCards?.length > 0,
                },
              }),
            );
            return newState;
          });
          setPendingGameStart(null);
          break;

        case "number_called":
          setGameState((prev) => {
            if (payload.gameId && prev.gameId && payload.gameId !== prev.gameId)
              return prev;
            const newNumbers = [...prev.calledNumbers];
            if (!newNumbers.includes(payload.number)) {
              newNumbers.push(payload.number);
            }
            return {
              ...prev,
              currentNumber: payload.number,
              calledNumbers: payload.calledNumbers || newNumbers,
            };
          });
          break;

        case "players_update":
          setGameState((prev) => ({
            ...prev,
            playersCount: payload.playersCount,
            prizePool: payload.prizePool,
          }));
          break;

        case "registration_update":
          setGameState((prev) => ({
            ...prev,
            takenCards: payload.takenCards || [],
            prizePool: payload.prizePool,
          }));
          break;

        case "selection_confirmed":
          setGameState((prev) => ({
            ...prev,
            yourSelections: payload.selections || prev.yourSelections || [],
            playersCount: payload.playersCount,
            prizePool: payload.prizePool,
          }));
          break;

        case "selection_cleared":
          setGameState((prev) => ({
            ...prev,
            yourSelections: payload.selections || [],
            playersCount: payload.playersCount ?? prev.playersCount,
            prizePool: payload.prizePool ?? prev.prizePool,
          }));
          break;

        case "bingo_accepted":
          setGameState((prev) => ({
            ...prev,
            winners: payload.winners || prev.winners || [],
          }));
          break;

        case "bingo_rejected":
          window.dispatchEvent(
            new CustomEvent("bingoRejected", { detail: payload }),
          );
          break;

        case "game_finished":
        case "game_ended":
          gameEndedRef.current = true;
          setGameState((prev) => {
            const currentUserId = safeSessionId;
            const userWon = payload.winners?.some(
              (w) =>
                w.userId === currentUserId ||
                w.userId?.toString() === currentUserId,
            );
            const userPrize =
              payload.winners?.find(
                (w) =>
                  w.userId === currentUserId ||
                  w.userId?.toString() === currentUserId,
              )?.prize || 0;

            return {
              ...prev,
              phase: "announce",
              gameId: payload?.gameId || prev.gameId,
              winners: payload.winners || prev.winners || [],
              calledNumbers: payload.calledNumbers || prev.calledNumbers,
              currentNumber: null,
              yourCards: [],
              yourSelections: [],
              nextRegistrationStart: payload?.nextStartAt || null,
              youWon: userWon,
              yourPrize: userPrize,
            };
          });
          break;

        case "wallet_update":
          setGameState((prev) => ({
            ...prev,
            walletUpdate: {
              main: payload.main,
              play: payload.play,
              coins: payload.coins,
              bonus: payload.bonus,
              source: payload.source,
            },
          }));
          window.dispatchEvent(
            new CustomEvent("walletUpdate", { detail: event }),
          );
          break;

        default:
          console.log("Unhandled event:", type);
      }
    },
    [safeSessionId],
  );

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
          youWon: false,
          yourPrize: 0,
          walletUpdate: null,
          nextRegistrationStart: null,
          totalCartellas: 200,
        });
        setCurrentStake(stake);
        gameEndedRef.current = false;
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "join_room", payload: { stake } }));
      } else if (ws && ws.readyState === WebSocket.CONNECTING) {
        const onOpen = () => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({ type: "join_room", payload: { stake } }),
            );
          }
          ws.removeEventListener("open", onOpen);
        };
        ws.addEventListener("open", onOpen);
      } else if (!connected && !isConnecting) {
        connectGeneral();
      }
    },
    [safeSessionId, currentStake, connected, isConnecting, connectGeneral],
  );

  // Auto-connect when sessionId becomes available
  useEffect(() => {
    isMountedRef.current = true;
    if (
      safeSessionId &&
      !connected &&
      !isConnecting &&
      !connectionAttemptRef.current
    ) {
      connectGeneral();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [safeSessionId, connected, isConnecting, connectGeneral]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [cleanup]);

  const selectCartella = useCallback(
    (cardNumber) => send("select_card", { cardNumber }),
    [send],
  );
  const deselectCartella = useCallback(
    (cardNumber) => send("deselect_card", { cardNumber }),
    [send],
  );
  const claimBingo = useCallback(
    (payload = {}) => send("bingo_claim", payload),
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
    forceReconnect: connectGeneral,
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
