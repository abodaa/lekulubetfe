import React, { useState, useEffect } from "react";
import Game from "./pages/Game";
import Rules from "./components/Rules";
import Scores from "./pages/Scores";
import History from "./pages/History";
import Wallet from "./pages/Wallet";
import Profile from "./pages/Profile";
import CartelaSelection from "./pages/CartelaSelection.jsx";
import GameLayout from "./pages/GameLayout.jsx";
import Winner from "./pages/Winner.jsx";
import { AuthProvider } from "./lib/auth/AuthProvider.jsx";
import { ToastProvider, useToast } from "./contexts/ToastContext.jsx";
import {
  WebSocketProvider,
  useWebSocket,
} from "./contexts/WebSocketContext.jsx";
import AdminLayout from "./admin/AdminLayout.jsx";

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

  // Error monitoring and debugging
  useEffect(() => {
    const logState = () => {
      console.log("🔍 App State Debug:", {
        currentPage,
        selectedStake,
        selectedCartelas,
        currentGameId,
        connected,
        gameState: {
          phase: gameState.phase,
          gameId: gameState.gameId,
          playersCount: gameState.playersCount,
          yourCards: Array.isArray(gameState.yourCards)
            ? gameState.yourCards.length
            : 0,
        },
        timestamp: new Date().toISOString(),
      });
    };

    const interval = setInterval(logState, 5000);
    logState();
    return () => clearInterval(interval);
  }, [
    currentPage,
    selectedStake,
    selectedCartelas,
    currentGameId,
    connected,
    gameState,
  ]);

  // Specific check for authentication and initial load
  useEffect(() => {
    console.log("🚀 App initialized with:", {
      currentPage,
      selectedStake,
      connected,
      hasGameState: !!gameState,
      gamePhase: gameState?.phase,
      timestamp: new Date().toISOString(),
    });
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

  // Check if user has any cartellas
  const hasUserCards = () => {
    return (
      (Array.isArray(gameState.yourCards) && gameState.yourCards.length > 0) ||
      selectedCartelas.length > 0
    );
  };

  // Check if game has enough players
  const hasEnoughPlayers = () => {
    return (
      typeof gameState.playersCount === "number" && gameState.playersCount >= 2
    );
  };

  // Smart navigation function
  const determineGamePage = () => {
    console.log("Determining game page:", {
      phase: gameState.phase,
      gameId: gameState.gameId,
      hasCards: hasUserCards(),
      hasPlayers: hasEnoughPlayers(),
      selectedStake,
    });

    // No stake selected - go to game selection
    if (!selectedStake) {
      return "game";
    }

    // Game finished (announce phase)
    if (gameState.phase === "announce" && gameState.gameId) {
      if (hasUserCards()) {
        console.log("→ Player with cards - going to winner page");
        return "winner";
      } else {
        console.log("→ Watch mode - going to cartela selection");
        return "cartela-selection";
      }
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

  // Listen for custom gameStarted event
  useEffect(() => {
    const handleGameStarted = (event) => {
      console.log("🎯 gameStarted custom event received:", event.detail);
      if (!selectedStake) return;

      const playersCount = event.detail?.playersCount || gameState.playersCount;
      const hasPlayers = typeof playersCount === "number" && playersCount >= 2;

      if (
        event.detail.phase === "running" &&
        event.detail.gameId &&
        hasPlayers &&
        currentPage !== "game-layout"
      ) {
        console.log("🚀 FORCE NAVIGATING to game-layout");
        setCurrentPage("game-layout");
      }
    };

    window.addEventListener("gameStarted", handleGameStarted);
    return () => window.removeEventListener("gameStarted", handleGameStarted);
  }, [selectedStake, currentPage, gameState.playersCount]);

  // Auto-navigate based on game state changes
  useEffect(() => {
    if (!selectedStake) {
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
    selectedStake,
    currentPage,
  ]);

  // Handle query parameter routing
  useEffect(() => {
    const checkUrlParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const isAdmin = urlParams.get("admin") === "true";
      const stakeParam = urlParams.get("stake");

      if (isAdmin) {
        setCurrentPage("admin");
      } else {
        if (stakeParam) {
          const stakeValue = parseInt(stakeParam);
          if (stakeValue && [10, 20, 50].includes(stakeValue)) {
            setSelectedStake(stakeValue);
            localStorage.setItem("selectedStake", stakeValue.toString());
          }
        }
        setCurrentPage("game");
      }
    };

    checkUrlParams();
    window.addEventListener("popstate", checkUrlParams);
    return () => window.removeEventListener("popstate", checkUrlParams);
  }, []);

  const handleStakeSelected = (stake) => {
    setSelectedStake(stake);
    setCurrentPage("cartela-selection");
  };

  const handleResetToGame = () => {
    setSelectedStake(null);
    setSelectedCartelas([]);
    setCurrentGameId(null);
    setCurrentPage("game");
  };

  const handleNavigate = (page, forceDirect = false) => {
    setIsNavigating(true);

    setTimeout(() => {
      if (page === "game" && !forceDirect) {
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
        setCurrentPage(page);
      }
      setIsNavigating(false);
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
      {renderPage()}

      {/* Navigation Loading Overlay */}
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
