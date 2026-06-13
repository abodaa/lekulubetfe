import React, { useState, useEffect, lazy, Suspense } from "react";
import Game from "./pages/Game"; // eager: default landing page
// In-game flow is eager so the stake -> cartella -> game -> winner path NEVER
// waits on a code chunk (no Suspense spinner mid-flow, even on first load).
import CartelaSelection from "./pages/CartelaSelection.jsx";
import GameLayout from "./pages/GameLayout.jsx";
import Winner from "./pages/Winner.jsx";
import GroupHub from "./pages/GroupHub.jsx";
import { AuthProvider } from "./lib/auth/AuthProvider.jsx";
import { ToastProvider, useToast } from "./contexts/ToastContext.jsx";
import {
  WebSocketProvider,
  useWebSocket,
} from "./contexts/WebSocketContext.jsx";
// Secondary tab pages stay lazy (not in the immediate game path).
const Rules = lazy(() => import("./components/Rules"));
const Scores = lazy(() => import("./pages/Scores"));
const History = lazy(() => import("./pages/History"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Profile = lazy(() => import("./pages/Profile"));
// Admin is the big, rarely-used bundle — keep it lazy.
const AdminLayout = lazy(() => import("./admin/AdminLayout.jsx"));

// Inner component that has access to WebSocket context
function AppContent() {
  const [currentPage, setCurrentPage] = useState("game");
  const [selectedStake, setSelectedStake] = useState(null);
  const [selectedCartelas, setSelectedCartelas] = useState([]);
  const [currentGameId, setCurrentGameId] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(false);

  // Access WebSocket context for smart navigation
  const { gameState, connected } = useWebSocket();
  const { showSuccess } = useToast();

  // Clear localStorage stake on mount to always start fresh
  useEffect(() => {
    localStorage.removeItem("selectedStake");
  }, []);

  // Set a timeout for WebSocket connection
  useEffect(() => {
    if (selectedStake && !connected) {
      const timeout = setTimeout(() => {
        setConnectionTimeout(true);
      }, 10000);
      return () => clearTimeout(timeout);
    } else {
      setConnectionTimeout(false);
    }
  }, [selectedStake, connected]);

  // Helper functions
  const hasUserCards = () => {
    return (
      (Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0) ||
      selectedCartelas.length > 0
    );
  };

  const hasEnoughPlayers = () => {
    return (
      typeof gameState.playersCount === "number" && gameState.playersCount >= 2
    );
  };

  // Smart navigation function
  const determineGamePage = () => {
    // No stake selected - go to game selection
    if (!selectedStake) {
      return "game";
    }

    // Game finished (announce phase) - PRIORITY #1
    if (gameState.phase === "announce") {
      console.log("→ GAME FINISHED - GOING TO WINNER PAGE");
      return "winner";
    }

    // Game is running or starting
    if (
      (gameState.phase === "running" || gameState.phase === "starting") &&
      gameState.gameId
    ) {
      if (hasEnoughPlayers()) {
        console.log("→ Game active - going to game layout");
        return "game-layout";
      } else {
        console.log("→ Not enough players - going to cartela selection");
        return "cartela-selection";
      }
    }

    // Registration phase
    if (gameState.phase === "registration" && gameState.gameId) {
      console.log("→ Registration open - going to cartela selection");
      return "cartela-selection";
    }

    // Waiting or no game - go to cartela selection if stake selected
    if (selectedStake) {
      return "cartela-selection";
    }

    return "game";
  };

  // Auto-navigate based on game state changes
  useEffect(() => {
    if (!selectedStake) {
      return;
    }

    // Don't auto-navigate if we're already on winner page
    if (currentPage === "winner") {
      console.log("Already on winner page, skipping auto-navigation");
      return;
    }

    const targetPage = determineGamePage();
    console.log("🎯 Target page:", targetPage, "Current page:", currentPage);

    if (targetPage !== currentPage) {
      console.log("✅ NAVIGATING to:", targetPage);
      setCurrentPage(targetPage);
    }
  }, [
    gameState.phase,
    gameState.gameId,
    gameState.playersCount,
    gameState.yourCards,
    gameState.winners,
    selectedStake,
    currentPage,
  ]);

  // Handle query parameter routing
  useEffect(() => {
    const checkUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isAdmin = urlParams.get("admin") === "true";
      const stakeParam = urlParams.get("stake");
      const pageParam = urlParams.get("page");

      if (isAdmin) {
        setCurrentPage("admin");
      } else if (pageParam === "leaderboard") {
        setCurrentPage("scores");
      } else {
        if (stakeParam) {
          const stakeValue = parseInt(stakeParam);
          if (stakeValue && [10, 20, 50].includes(stakeValue)) {
            setSelectedStake(stakeValue);
            localStorage.setItem("selectedStake", stakeValue.toString());
            setCurrentPage("cartela-selection");
          }
        }
        if (!stakeParam && !selectedStake) {
          setCurrentPage("game");
        }
      }
    };

    checkUrlParams();
    window.addEventListener("popstate", checkUrlParams);
    return () => window.removeEventListener("popstate", checkUrlParams);
  }, []);

  // Restore stake from reconnect
  useEffect(() => {
    const reconnectStake = sessionStorage.getItem("reconnect_stake");
    const reconnectTimestamp = sessionStorage.getItem("reconnect_timestamp");

    if (reconnectStake && reconnectTimestamp) {
      const timestamp = parseInt(reconnectTimestamp);
      if (Date.now() - timestamp < 10000) {
        const stakeValue = parseInt(reconnectStake);
        if (stakeValue && [10, 20, 50].includes(stakeValue)) {
          console.log("🔄 Restoring stake from reconnect:", stakeValue);
          setSelectedStake(stakeValue);
          localStorage.setItem("selectedStake", stakeValue.toString());
          setCurrentPage("cartela-selection");
        }
      }
      sessionStorage.removeItem("reconnect_stake");
      sessionStorage.removeItem("reconnect_timestamp");
    }
  }, []);

  const handleStakeSelected = (stake) => {
    setSelectedStake(stake);
    setCurrentPage("cartela-selection");
  };

  const handleResetToGame = () => {
    localStorage.removeItem("selectedStake");
    setSelectedStake(null);
    setSelectedCartelas([]);
    setCurrentGameId(null);
    setCurrentPage("game");
  };

  const navigationInProgressRef = React.useRef(false);

  const handleNavigate = (page, forceDirect = false) => {
    // In-game flow transitions must be instant — no loading overlay or delay —
    // so finishing a game lands on results / cartella selection without a flash.
    if (page === "winner" || page === "cartela-selection") {
      navigationInProgressRef.current = false;
      setIsNavigating(false);
      setCurrentPage(page);
      return;
    }

    if (navigationInProgressRef.current) return;
    navigationInProgressRef.current = true;
    setIsNavigating(true);

    setTimeout(() => {
      if (page === "game") {
        if (!forceDirect) {
          const targetPage = determineGamePage();
          if (targetPage !== "game") {
            const messages = {
              "game-layout": "🎮 Returning to your active game!",
              "cartela-selection": "🎫 Taking you to cartella selection",
              winner: "🏆 Showing game results",
            };
            showSuccess(messages[targetPage] || "Taking you to your game");
          }
          setCurrentPage(targetPage);
        } else {
          setSelectedStake(null);
          setSelectedCartelas([]);
          setCurrentGameId(null);
          localStorage.removeItem("selectedStake");
          setCurrentPage("game");
        }
      } else {
        setCurrentPage(page);
      }
      setIsNavigating(false);
      setTimeout(() => {
        navigationInProgressRef.current = false;
      }, 300);
    }, 150);
  };

  const renderPage = () => {
    switch (currentPage) {
      case "game":
        return (
          <Game
            onNavigate={handleNavigate}
            onStakeSelected={handleStakeSelected}
            selectedStake={selectedStake}
          />
        );
      case "cartela-selection":
        return (
          <CartelaSelection
            onNavigate={handleNavigate}
            onResetToGame={handleResetToGame}
            stake={selectedStake}
            onCartelaSelected={(cartelaNumbers) => {
              setSelectedCartelas(
                Array.isArray(cartelaNumbers) ? cartelaNumbers : [],
              );
              setCurrentPage("game-layout");
            }}
            onGameIdUpdate={(gameId) => setCurrentGameId(gameId)}
          />
        );
      case "admin":
        return <AdminLayout onNavigate={handleNavigate} />;
      case "group-hub":
        return <GroupHub onNavigate={handleNavigate} />;
      case "game-layout":
        return (
          <GameLayout
            onNavigate={handleNavigate}
            onResetToGame={handleResetToGame}
            stake={selectedStake}
            selectedCartelas={selectedCartelas}
          />
        );
      case "rules":
        return <Rules onNavigate={handleNavigate} />;
      case "scores":
        return <Scores onNavigate={handleNavigate} />;
      case "history":
        return <History onNavigate={handleNavigate} />;
      case "wallet":
        return <Wallet onNavigate={handleNavigate} />;
      case "profile":
        return <Profile onNavigate={handleNavigate} />;
      case "winner":
        return (
          <Winner
            onNavigate={handleNavigate}
            onResetToGame={handleResetToGame}
          />
        );
      default:
        return (
          <Game
            onNavigate={handleNavigate}
            onStakeSelected={handleStakeSelected}
            selectedStake={selectedStake}
          />
        );
    }
  };

  return (
    <div className="App">
      <Suspense
        fallback={
          <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        }
      >
        {renderPage()}
      </Suspense>

      {isNavigating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3"></div>
            <div className="text-white text-sm">Loading...</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main App component with providers
function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <WebSocketProvider>
          <AppContent />
        </WebSocketProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
