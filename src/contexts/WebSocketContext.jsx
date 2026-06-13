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

// Convert the server's authoritative remaining time into a LOCAL-clock deadline,
// so the on-screen countdown is identical across devices regardless of each
// device's wall-clock skew. Prefers countdownSeconds; then (endsAt - serverTime),
// which are both server-clock values so they cancel out; only falls back to the
// local clock as a last resort.
function localCountdownAnchor(payload = {}) {
  const endsAt = payload.endsAt ?? payload.registrationEndTime ?? null;
  const now = Date.now();
  let localEndTime;
  if (endsAt != null) {
    // Prefer the server's ABSOLUTE end time, translated into this device's clock
    // via serverTime. Every client then counts down to the same instant,
    // regardless of receipt latency or local clock differences — keeping all
    // joined players' timers in sync.
    const skew = payload.serverTime != null ? now - payload.serverTime : 0;
    localEndTime = endsAt + skew;
  } else if (payload.countdownSeconds != null) {
    localEndTime =
      now + Math.max(0, Math.floor(payload.countdownSeconds)) * 1000;
  } else {
    localEndTime = now;
  }
  const remaining = Math.max(0, Math.ceil((localEndTime - now) / 1000));
  return { remaining, localEndTime };
}

function clearStoredGroupCode() {
  try {
    sessionStorage.removeItem("lekulu_group_code");
  } catch {
    /* ignore */
  }
}

export function WebSocketProvider({ children }) {
  const { sessionId } = useAuth();
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const connectionAttemptRef = useRef(false);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  // Hold latest values so the connect callback doesn't need them as deps
  // (prevents the socket from tearing down on every number call).
  const resumeRef = useRef(null);
  const currentStakeRef = useRef(null);
  const currentGroupCodeRef = useRef(
    (() => {
      try {
        return sessionStorage.getItem("lekulu_group_code") || null;
      } catch {
        return null;
      }
    })(),
  );

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
  // Play in Group state. `group` holds the lobby/membership for the group the
  // user is currently in (null when not in a group). `groupStatus` is one of
  // null | "pending" | "lobby" | "in_game".
  const [group, setGroup] = useState(null);
  const [groupStatus, setGroupStatus] = useState(null);
  const [openGroups, setOpenGroups] = useState([]);
  const [messageCount, setMessageCount] = useState(0);
  const [pendingGameStart, setPendingGameStart] = useState(null);
  const rejoinScheduledRef = useRef(false);
  const pendingSendsRef = useRef([]);
  const cardResyncRef = useRef({ gameId: null, tries: 0 });

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
    if (gameState.phase !== "registration" || !gameState.registrationEndTime)
      return;
    const endTime = gameState.registrationEndTime;
    let timeoutId = null;
    let intervalId = null;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setGameState((prev) =>
        prev.countdown === remaining ? prev : { ...prev, countdown: remaining },
      );
      if (remaining <= 0) {
        if (intervalId) clearInterval(intervalId);
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    // Compute immediately (no 1s delay), then align subsequent ticks to the
    // end-time's whole-second boundaries so every device flips the displayed
    // number at the same wall-clock instant (endTime is already clock-skew
    // corrected), eliminating the visible cross-device timer drift.
    tick();
    const msToBoundary =
      (((endTime - Date.now()) % 1000) + 1000) % 1000 || 1000;
    timeoutId = setTimeout(() => {
      tick();
      intervalId = setInterval(tick, 1000);
    }, msToBoundary);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [gameState.phase, gameState.registrationEndTime]);

  // ========== NETWORK RECOVERY - RESUME DRAW AFTER RECONNECT ==========
  const resumeGameAfterReconnect = useCallback(async () => {
    if (!currentStake || !safeSessionId) return false;

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

  // Keep refs pointed at the latest resume fn / stake without forcing the
  // connect callback to re-create (which would churn the WebSocket).
  useEffect(() => {
    resumeRef.current = resumeGameAfterReconnect;
    currentStakeRef.current = currentStake;
  });

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

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("Already connected to general WebSocket");
      return;
    }

    if (connectionAttemptRef.current) {
      console.log("General connection already in progress, skipping");
      return;
    }

    connectionAttemptRef.current = true;

    // Cancel any pending auto-reconnect from a previous (now-superseded) attempt
    // so we don't end up with two competing sockets.
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

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
      // Pass the stake on the handshake so the server can auto-join the room
      // and push the snapshot immediately — saves a full join_room round-trip.
      // (The join_room sent in onopen below is now idempotent server-side.)
      // If the user is in a private group, carry the group code instead so the
      // server auto-rejoins the group room on (re)connect.
      const groupCode = currentGroupCodeRef.current;
      const stakeQuery = groupCode
        ? `&group=${groupCode}`
        : currentStake
          ? `&stake=${currentStake}`
          : "";
      const wsUrl = `${wsBase}?token=${safeSessionId}${stakeQuery}`;
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

        // Flush any group/action messages queued while the socket was opening.
        if (pendingSendsRef.current.length) {
          const queued = pendingSendsRef.current.splice(0);
          queued.forEach((m) => {
            try {
              ws.send(JSON.stringify(m));
            } catch (e) {}
          });
        }

        heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);

        // Resume game after reconnect (via ref to avoid dep churn)
        setTimeout(() => {
          if (currentStakeRef.current) {
            resumeRef.current?.();
          }
        }, 500);

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
              setGameState((prev) => ({
                ...prev,
                ...event.payload,
              }));
              break;

            case "snapshot": {
              setGameState((prev) => {
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

                const {
                  remaining: serverCountdown,
                  localEndTime: registrationEndTime,
                } = localCountdownAnchor({
                  endsAt:
                    event.payload.endsAt ||
                    event.payload.nextStartAt ||
                    event.payload.registrationEndTime,
                  serverTime: event.payload.serverTime,
                  countdownSeconds: event.payload.countdownSeconds,
                });

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

                const resolvedCalled =
                  event.payload.calledNumbers ||
                  event.payload.called ||
                  prev.calledNumbers ||
                  [];
                const latestCalled =
                  resolvedCalled.length > 0
                    ? resolvedCalled[resolvedCalled.length - 1]
                    : null;

                const newState = {
                  ...prev,
                  playersCount:
                    event.payload.playersCount ?? prev.playersCount ?? 0,
                  prizePool: event.payload.prizePool ?? prev.prizePool ?? 0,
                  takenCards: event.payload.takenCards || prev.takenCards || [],
                  availableCards:
                    event.payload.availableCards || prev.availableCards || [],
                  phase,
                  gameId,
                  calledNumbers: resolvedCalled,
                  countdown: serverCountdown,
                  registrationEndTime,
                  yourCards: phase === "registration" ? [] : finalCards,
                  yourSelections:
                    phase === "registration" ? [] : finalSelections,
                  totalCartellas:
                    event.payload.totalCartellas || prev.totalCartellas || 200,
                  ...(phase === "registration"
                    ? { currentNumber: null, winners: [] }
                    : { currentNumber: latestCalled ?? prev.currentNumber }),
                };

                return newState;
              });
              break;
            }

            case "registration_open": {
              const {
                remaining: serverCountdown,
                localEndTime: registrationEndTime,
              } = localCountdownAnchor(event.payload);
              setGameState((prev) => {
                // A running game must never be reverted to selection by a stray,
                // late, or duplicate registration broadcast. The only way out of
                // "running" is the game finishing (announce). A genuine new round
                // is always preceded by the game ending first.
                if (prev.phase === "running") return prev;
                return {
                  ...prev,
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
                };
              });
              break;
            }

            case "registration_extended": {
              const {
                remaining: serverCountdown,
                localEndTime: registrationEndTime,
              } = localCountdownAnchor(event.payload);
              setGameState((prev) => {
                // You can't "extend registration" on a game that's already
                // running — ignore it so it can't kick a playing client back to
                // the selection screen.
                if (prev.phase === "running") return prev;
                return {
                  ...prev,
                  phase: "registration",
                  gameId: event.payload.gameId || prev.gameId,
                  playersCount:
                    event.payload.playersCount ?? prev.playersCount ?? 0,
                  countdown: serverCountdown,
                  registrationEndTime,
                  takenCards: event.payload.takenCards || prev.takenCards || [],
                  prizePool: event.payload.prizePool ?? prev.prizePool ?? 0,
                };
              });
              break;
            }

            case "registration_closed": {
              setGameState((prev) => ({
                ...prev,
                phase: "starting",
                gameId: event.payload?.gameId || prev.gameId,
                countdown: 0,
              }));
              break;
            }

            case "game_started":
              setGameState((prev) => {
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
                const newState = {
                  ...prev,
                  phase: "running",
                  gameId: event.payload.gameId,
                  playersCount: event.payload.playersCount,
                  prizePool: event.payload.prizePool,
                  calledNumbers:
                    event.payload.calledNumbers || event.payload.called || [],
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
                const pid = event.payload.gameId;
                // Ignore only if we're already in a DIFFERENT running game
                // (stale numbers from a game we left). Otherwise ADOPT it: a
                // called number proves the round is live, so recover even if we
                // missed the one-shot game_started/registration_closed (e.g. a
                // brief disconnect). This prevents a client being stranded on
                // the selection screen while numbers stream in.
                if (
                  pid &&
                  prev.gameId &&
                  pid !== prev.gameId &&
                  prev.phase === "running"
                ) {
                  return prev;
                }
                return {
                  ...prev,
                  phase: "running",
                  gameId: pid || prev.gameId,
                  currentNumber: event.payload.number,
                  calledNumbers:
                    event.payload.calledNumbers || event.payload.called || [],
                };
              });
              break;

            case "players_update":
              setGameState((prev) => {
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
              setGameState((prev) => {
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
              setGameState((prev) => {
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
              setGameState((prev) => ({
                ...prev,
                yourSelections:
                  event.payload.selections || prev.yourSelections || [],
                takenCards: event.payload.takenCards || prev.takenCards,
                playersCount: event.payload.playersCount || prev.playersCount,
              }));
              break;

            case "selection_cleared":
              setGameState((prev) => ({
                ...prev,
                yourSelections: event.payload.selections || [],
                playersCount: event.payload.playersCount ?? prev.playersCount,
                prizePool: event.payload.prizePool ?? prev.prizePool,
              }));
              break;

            case "bingo_accepted":
              setGameState((prev) => ({
                ...prev,
                winners: event.payload.winners || prev.winners || [],
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
              console.log("🏁 WebSocket - Game finished event received:", {
                gameId: event.payload?.gameId,
                winnersCount: event.payload.winners?.length,
                winners: event.payload.winners,
              });

              setGameState((prev) => {
                if (
                  event.payload?.gameId &&
                  prev.gameId &&
                  event.payload.gameId !== prev.gameId
                )
                  return prev;

                const currentUserId = safeSessionId;
                const userWon = event.payload.winners?.some(
                  (w) =>
                    w.userId === currentUserId ||
                    w.userId?.toString() === currentUserId,
                );
                const userPrize =
                  event.payload.winners?.find(
                    (w) =>
                      w.userId === currentUserId ||
                      w.userId?.toString() === currentUserId,
                  )?.prize || 0;

                // Convert the server's absolute next-start time into a
                // local-clock deadline so the Winner countdown reads the same on
                // every device regardless of wall-clock skew.
                const nextStart = event.payload?.nextStartAt
                  ? localCountdownAnchor({
                      endsAt: event.payload.nextStartAt,
                      serverTime: event.payload.serverTime,
                    }).localEndTime
                  : null;

                // IMPORTANT: Keep winners data, don't clear them
                const newState = {
                  ...prev,
                  phase: "announce",
                  gameId: event.payload?.gameId || prev.gameId,
                  winners: event.payload.winners || prev.winners || [], // Keep winners
                  calledNumbers:
                    event.payload.calledNumbers || prev.calledNumbers,
                  currentNumber: null,
                  yourCards: [], // Clear user's cards
                  yourSelections: [],
                  nextRegistrationStart: nextStart,
                  youWon: userWon,
                  yourPrize: userPrize,
                };

                console.log("🏆 WebSocket - New gameState:", {
                  phase: newState.phase,
                  winnersCount: newState.winners.length,
                  youWon: newState.youWon,
                });

                return newState;
              });
              break;

            case "wallet_update":
              setGameState((prev) => ({
                ...prev,
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

            case "group_state": {
              const p = event.payload || {};
              currentGroupCodeRef.current = p.code || null;
              try {
                if (p.code) sessionStorage.setItem("lekulu_group_code", p.code);
              } catch {
                /* ignore */
              }
              setGroup({
                code: p.code,
                stake: p.stake,
                ownerId: p.ownerId,
                isOwner: !!p.isOwner,
                phase: p.phase,
                isOpen: !!p.isOpen,
                members: p.members || [],
                pending: p.pending || [],
                memberCount: p.memberCount || 0,
                you: p.you,
              });
              setGroupStatus(p.phase === "lobby" ? "lobby" : "in_game");
              if (p.phase === "lobby") {
                // A round just ended (or hasn't started) — clear the game slice
                // so GroupHub shows the lobby, not the previous board/winner.
                setGameState((prev) => ({
                  ...prev,
                  phase: "lobby",
                  gameId: null,
                  calledNumbers: [],
                  currentNumber: null,
                  winners: [],
                  youWon: false,
                  yourPrize: 0,
                  yourCards: [],
                  yourSelections: [],
                  takenCards: [],
                  countdown: 0,
                  registrationEndTime: null,
                }));
              }
              break;
            }

            case "group_join_pending": {
              const p = event.payload || {};
              currentGroupCodeRef.current = p.code || null;
              setGroupStatus("pending");
              setGroup((prev) => ({
                ...(prev || {}),
                code: p.code,
                stake: p.stake,
                phase: "lobby",
                isOwner: false,
              }));
              break;
            }

            case "group_join_requested":
              // Owner-side: surface a quick toast; the pending list itself
              // arrives via the following group_state broadcast.
              window.dispatchEvent(
                new CustomEvent("groupJoinRequested", {
                  detail: event.payload,
                }),
              );
              break;

            case "group_join_approved":
              // The server follows this with a group_state that flips us into the
              // lobby; nothing else to do here.
              break;

            case "group_join_rejected":
            case "group_left":
              currentGroupCodeRef.current = null;
              clearStoredGroupCode();
              setGroup(null);
              setGroupStatus(null);
              window.dispatchEvent(
                new CustomEvent("groupClosed", {
                  detail: { reason: event.type, ...(event.payload || {}) },
                }),
              );
              break;

            case "group_dissolved":
              currentGroupCodeRef.current = null;
              clearStoredGroupCode();
              setGroup(null);
              setGroupStatus(null);
              setGameState((prev) => ({ ...prev, phase: "waiting" }));
              window.dispatchEvent(
                new CustomEvent("groupClosed", {
                  detail: { reason: "group_dissolved" },
                }),
              );
              break;

            case "group_list":
              setOpenGroups(event.payload?.groups || []);
              break;

            case "group_error":
              window.dispatchEvent(
                new CustomEvent("groupError", { detail: event.payload }),
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
        console.log(
          `🔌 WebSocket closed: ${event.code} - ${event.reason || "No reason"}`,
        );
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
            `🔄 Reconnecting WebSocket in ${delay}ms (attempt ${retry + 1})`,
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
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
  }, [safeSessionId, currentStake]);

  const connectToStake = useCallback(
    (stake) => {
      if (!safeSessionId || !stake) return;
      // While in a private group, ignore public stake joins entirely. The group
      // connection is managed via the group code on the socket URL, and the
      // in-game screens (which call connectToStake on their own) must not pull
      // the user out of the group room into a public one.
      if (currentGroupCodeRef.current) return;
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
      }

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "join_room", payload: { stake } }));
        } catch (e) {}
      } else if (ws && ws.readyState === WebSocket.CONNECTING) {
        const onOpen = () => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
              wsRef.current.send(
                JSON.stringify({ type: "join_room", payload: { stake } }),
              );
            } catch (e) {}
          }
          ws.removeEventListener("open", onOpen);
        };
        ws.addEventListener("open", onOpen);
      } else {
        // Socket is missing, closing, or closed. Force a clean reconnect even if
        // `connected` is still stale-true from a dropped socket (otherwise the
        // app gets stuck "Not connected" and Refresh does nothing).
        if (ws) {
          try {
            ws.close();
          } catch (e) {}
        }
        wsRef.current = null;
        connectionAttemptRef.current = false;
        setConnected(false);
        connectGeneral();
      }
    },
    [safeSessionId, currentStake, connected, isConnecting, connectGeneral],
  );

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

        // Convert the server's deadline into a local-clock deadline using the
        // serverTime/countdownSeconds now included in the status response, so a
        // mid-registration reconnect shows the same countdown as everyone else.
        const recoveredRegEnd = data.game.registrationEndsAt
          ? localCountdownAnchor({
              endsAt: new Date(data.game.registrationEndsAt).getTime(),
              serverTime: data.game.serverTime,
              countdownSeconds: data.game.countdownSeconds,
            }).localEndTime
          : null;

        setGameState((prev) => ({
          ...prev,
          calledNumbers: data.game.calledNumbers || [],
          currentNumber: data.game.lastCalledNumber || prev.currentNumber,
          phase: data.game.status === "running" ? "running" : prev.phase,
          gameId: data.game.gameId || prev.gameId,
          playersCount: data.game.playersCount || prev.playersCount,
          prizePool: data.game.totalPrizes || prev.prizePool,
          registrationEndTime: recoveredRegEnd ?? prev.registrationEndTime,
        }));

        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to recover game state:", error);
      return false;
    }
  }, [currentStake, safeSessionId]);

  const forceReconnect = useCallback(
    async (stake) => {
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
        setTimeout(() => {
          recoverGameStateFromHTTP();
        }, 2000);
      } else {
        connectGeneral();
      }
    },
    [connectToStake, connectGeneral, recoverGameStateFromHTTP],
  );

  // Auto-recover the socket when the network comes back or the tab is refocused.
  // Without this, a connection dropped during an outage that exhausts the retry
  // loop never reconnects on its own — the user is stuck "Not connected" until a
  // full reload, and even Refresh can't help if `connected` was left stale.
  useEffect(() => {
    if (!safeSessionId) return;
    const tryRecover = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false)
        return;
      const rs = wsRef.current?.readyState;
      if (rs === WebSocket.OPEN || rs === WebSocket.CONNECTING) return;
      const stake = currentStakeRef.current;
      if (stake) connectToStake(stake);
      else connectGeneral();
    };
    const onOnline = () => tryRecover();
    const onVisible = () => {
      if (document.visibilityState === "visible") tryRecover();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [safeSessionId, connectToStake, connectGeneral]);

  // If we adopted a running game (e.g. via number_called after missing the
  // one-shot game_started) but we selected cartellas and have no card grids,
  // pull a fresh snapshot — which includes our cards — once per game (capped).
  useEffect(() => {
    if (gameState.phase !== "running") return;
    const hasCards =
      Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0;
    const hadSelections =
      Array.isArray(gameState.yourSelections) &&
      gameState.yourSelections.length > 0;
    if (hasCards || !hadSelections) return;
    if (cardResyncRef.current.gameId !== gameState.gameId) {
      cardResyncRef.current = { gameId: gameState.gameId, tries: 0 };
    }
    if (cardResyncRef.current.tries >= 3) return;
    cardResyncRef.current.tries += 1;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (currentGroupCodeRef.current) {
        ws.send(
          JSON.stringify({
            type: "group_join_request",
            payload: { code: currentGroupCodeRef.current },
          }),
        );
      } else if (currentStakeRef.current) {
        ws.send(
          JSON.stringify({
            type: "join_room",
            payload: { stake: currentStakeRef.current },
          }),
        );
      }
    }
  }, [
    gameState.phase,
    gameState.yourCards,
    gameState.yourSelections,
    gameState.gameId,
  ]);

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

  useEffect(() => {
    isMountedRef.current = true;
    if (
      sessionId &&
      !connected &&
      !isConnecting &&
      !connectionAttemptRef.current
    ) {
      connectGeneral();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [sessionId, connected, isConnecting, connectGeneral]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const handleForceUpdate = (event) => {
      if (!event.detail) return;

      console.log("📡 WebSocket context received forced update:", event.detail);

      setGameState((prev) => ({
        ...prev,
        calledNumbers: event.detail.calledNumbers || prev.calledNumbers,
        currentNumber: event.detail.currentNumber || prev.currentNumber,
        gameId: event.detail.gameId || prev.gameId,
        phase: event.detail.phase || prev.phase,
        winners: event.detail.winners || prev.winners,
        youWon: event.detail.youWon || false,
        yourPrize: event.detail.yourPrize || 0,
      }));
    };

    window.addEventListener("forceGameStateUpdate", handleForceUpdate);
    return () => {
      window.removeEventListener("forceGameStateUpdate", handleForceUpdate);
    };
  }, []);

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

  // ---- Play in Group actions ----
  // Sends even if the socket is still opening: queues + (re)connects, then the
  // onopen handler flushes the queue.
  const groupSend = useCallback(
    (type, payload = {}) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type, payload }));
        } catch (e) {}
        return;
      }
      pendingSendsRef.current.push({ type, payload });
      if (!connectionAttemptRef.current) connectGeneral();
    },
    [connectGeneral],
  );

  const enterGroupMode = useCallback(() => {
    // Make sure we don't carry a public stake into the group connection.
    setCurrentStake(null);
    currentStakeRef.current = null;
  }, []);

  const createGroup = useCallback(
    (stake) => {
      enterGroupMode();
      groupSend("group_create", { stake: Number(stake) });
    },
    [enterGroupMode, groupSend],
  );
  const requestJoinGroup = useCallback(
    (code) => {
      enterGroupMode();
      currentGroupCodeRef.current = null;
      clearStoredGroupCode();
      groupSend("group_join_request", {
        code: String(code || "").toUpperCase(),
      });
    },
    [enterGroupMode, groupSend],
  );
  const approveJoin = useCallback(
    (userId) => groupSend("group_approve", { userId }),
    [groupSend],
  );
  const rejectJoin = useCallback(
    (userId) => groupSend("group_reject", { userId }),
    [groupSend],
  );
  const setGroupStake = useCallback(
    (stake) => groupSend("group_set_stake", { stake: Number(stake) }),
    [groupSend],
  );
  const setGroupOpen = useCallback(
    (isOpen) => groupSend("group_set_open", { isOpen: !!isOpen }),
    [groupSend],
  );
  const startGroup = useCallback(
    () => groupSend("group_start", {}),
    [groupSend],
  );
  const leaveGroup = useCallback(() => {
    groupSend("group_leave", {});
    currentGroupCodeRef.current = null;
    clearStoredGroupCode();
    setGroup(null);
    setGroupStatus(null);
  }, [groupSend]);
  const listOpenGroups = useCallback(
    () => groupSend("group_list_open", {}),
    [groupSend],
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
    // Play in Group
    group,
    groupStatus,
    openGroups,
    createGroup,
    requestJoinGroup,
    approveJoin,
    rejectJoin,
    setGroupStake,
    setGroupOpen,
    startGroup,
    leaveGroup,
    listOpenGroups,
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
