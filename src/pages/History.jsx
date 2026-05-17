import React, { useState, useEffect, useMemo } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { apiFetch } from "../lib/api/client";
import { motion } from "framer-motion";
import {
  FaHistory,
  FaGamepad,
  FaTrophy,
  FaCoins,
  FaCalendarAlt,
  FaArrowDown,
  FaArrowUp,
  FaClock,
} from "react-icons/fa";
import { GiPlayButton, GiConfirmed } from "react-icons/gi";

export default function History({ onNavigate }) {
  const { sessionId } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    if (!sessionId) {
      console.log("No sessionId available for history fetch");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), 12000);

    const fetchData = async () => {
      try {
        console.log("Fetching history data with sessionId:", sessionId);
        setLoading(true);
        setError(null);

        const [transactionsData, gamesData] = await Promise.all([
          apiFetch("/user/transactions", {
            sessionId,
            signal: controller.signal,
          }),
          apiFetch("/user/games", { sessionId, signal: controller.signal }),
        ]);

        console.log("Transactions data received:", transactionsData);
        console.log("Games data received:", gamesData);

        setTransactions(transactionsData?.transactions || []);
        setGames(gamesData?.games || []);
      } catch (error) {
        if (error?.name === "AbortError") {
          console.error("History fetch timed out");
          setError("Request timed out. Please try again.");
        } else {
          console.error("Failed to fetch history data:", error);
          setError("Unable to load your history right now.");
        }
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [sessionId]);

  const filteredTransactions = transactions.filter((transaction) => {
    if (activeTab === "all") return true;
    if (activeTab === "deposits") return transaction.type === "deposit";
    if (activeTab === "games")
      return ["game_bet", "game_win"].includes(transaction.type);
    return true;
  });

  const totalGames = games.length;
  const gamesWon = games.filter((g) => g.userResult?.won).length;
  const winRate =
    totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 0;

  const getTransactionIcon = (type, amount) => {
    if (type === "deposit")
      return <FaArrowDown className="text-green-400" size={12} />;
    if (type === "game_win")
      return <FaTrophy className="text-yellow-400" size={12} />;
    if (type === "game_bet")
      return <FaArrowUp className="text-red-400" size={12} />;
    return <FaCoins className="text-white/30" size={12} />;
  };

  const tabs = [
    { key: "all", label: "All", icon: <FaHistory size={12} /> },
    { key: "deposits", label: "Deposits", icon: <FaArrowDown size={12} /> },
    { key: "games", label: "Games", icon: <GiPlayButton size={12} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md pt-safe px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
              <FaHistory className="text-yellow-400" size={14} />
            </div>
            <span className="text-white/70 text-xs font-medium">
              GAME HISTORY
            </span>
          </div>
        </div>
      </div>

      <main className="px-4 pb-24 pt-16">
        {/* Stats Cards */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3 mb-6"
          >
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <FaGamepad className="text-white/40" size={14} />
              </div>
              <div className="text-white font-bold text-lg">{totalGames}</div>
              <div className="text-white/30 text-[9px] uppercase tracking-wider">
                Games
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <FaTrophy className="text-yellow-400" size={14} />
              </div>
              <div className="text-yellow-400 font-bold text-lg">
                {gamesWon}
              </div>
              <div className="text-white/30 text-[9px] uppercase tracking-wider">
                Wins
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <GiConfirmed className="text-green-400" size={14} />
              </div>
              <div className="text-green-400 font-bold text-lg">{winRate}%</div>
              <div className="text-white/30 text-[9px] uppercase tracking-wider">
                Win Rate
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <div className="flex gap-1 bg-white/5 rounded-full p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-medium transition-all ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Error State */}
        {error && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 text-center mb-4"
          >
            <p className="text-red-400 text-xs mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/30 transition-all"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Game History List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-2 px-1">
            Recent Games
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : games.length === 0 ? (
            <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                <FaGamepad className="text-white/20" size={24} />
              </div>
              <p className="text-white/30 text-xs">No games played yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {games.slice(0, 20).map((game, idx) => (
                <motion.div
                  key={game.id || idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white/5 backdrop-blur rounded-xl border border-white/10 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          game.userResult?.won
                            ? "bg-green-500/20"
                            : "bg-red-500/20"
                        }`}
                      >
                        {game.userResult?.won ? (
                          <FaTrophy className="text-yellow-400" size={12} />
                        ) : (
                          <FaArrowUp className="text-red-400" size={12} />
                        )}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">
                          Game {game.gameId}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <FaCalendarAlt className="text-white/20" size={8} />
                          <p className="text-white/30 text-[9px]">
                            {game.finishedAt
                              ? new Date(game.finishedAt).toLocaleDateString()
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`px-2 py-0.5 rounded-full text-[9px] font-medium ${
                        game.userResult?.won
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {game.userResult?.won ? "WON" : "LOST"}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-white/30">Stake:</span>
                        <span className="text-white ml-1">
                          {game.stake} ETB
                        </span>
                      </div>
                      <div>
                        <span className="text-white/30">Prize:</span>
                        <span className="text-green-400 ml-1">
                          {game.userResult?.prize || 0} ETB
                        </span>
                      </div>
                    </div>
                    <div className="text-white/30">{game.status}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </main>

      <BottomNav current="history" onNavigate={onNavigate} />
    </div>
  );
}
