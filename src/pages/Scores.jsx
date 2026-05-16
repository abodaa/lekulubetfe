import React, { useState, useEffect } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTrophy,
  FaMedal,
  FaCrown,
  FaCalendarAlt,
  FaUserCircle,
  FaChartLine,
} from "react-icons/fa";
import { MdEmojiEvents } from "react-icons/md";
import { GiTrophy } from "react-icons/gi";

export default function Scores({ onNavigate }) {
  const { sessionId, user } = useAuth();
  const [userStats, setUserStats] = useState({
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    totalWinnings: 0,
    winRate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [topFilter, setTopFilter] = useState("alltime");
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [leadersLoading, setLeadersLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    const fetchUserStats = async () => {
      try {
        setLoading(true);
        const timeoutId = setTimeout(() => {
          setLoading(false);
        }, 10000);

        const data = await apiFetch("/user/profile", { sessionId });
        const stats = data.user;
        setUserStats({
          totalGamesPlayed: stats.totalGamesPlayed || 0,
          totalGamesWon: stats.totalGamesWon || 0,
          totalWinnings: stats.totalWinnings || 0,
          winRate:
            stats.totalGamesPlayed > 0
              ? Math.round((stats.totalGamesWon / stats.totalGamesPlayed) * 100)
              : 0,
        });
        clearTimeout(timeoutId);
      } catch (error) {
        console.error("Failed to fetch user stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserStats();
  }, [sessionId]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLeadersLoading(true);
        const tryEndpoints = async () => {
          const endpoints = [
            `/api/leaderboard?period=${topFilter}`,
            `/leaderboard?period=${topFilter}`,
            `/stats/leaderboard?period=${topFilter}`,
            `/leaderboard/${topFilter}`,
          ];
          for (const path of endpoints) {
            try {
              const res = await apiFetch(path, { sessionId });
              return res;
            } catch (e) {
              // continue to next
            }
          }
          return null;
        };

        const data = await tryEndpoints();
        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.leaders)
            ? data.leaders
            : [];

        setLeaderboardRows(
          rows.map((r) => ({
            name: r.name || r.username || r.player || "Player",
            wins: Number(r.wins ?? r.totalWins ?? 0),
            played: Number(r.played ?? r.gamesPlayed ?? r.totalGames ?? 0),
          })),
        );
      } catch (e) {
        console.error("Failed to fetch leaderboard:", e);
        setLeaderboardRows([]);
      } finally {
        setLeadersLoading(false);
      }
    };
    fetchLeaderboard();
  }, [topFilter, sessionId]);

  const getRankIcon = (rank) => {
    if (rank === 1) return <FaCrown className="text-yellow-400" size={18} />;
    if (rank === 2) return <FaMedal className="text-gray-400" size={18} />;
    if (rank === 3) return <FaMedal className="text-amber-600" size={18} />;
    return (
      <span className="text-white/30 text-sm font-bold w-5 text-center">
        {rank}
      </span>
    );
  };

  const filterOptions = [
    { key: "alltime", label: "All Time", icon: <GiTrophy size={12} /> },
    { key: "monthly", label: "Month", icon: <FaCalendarAlt size={12} /> },
    { key: "weekly", label: "Week", icon: <FaCalendarAlt size={12} /> },
    { key: "daily", label: "Day", icon: <FaCalendarAlt size={12} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/80 to-transparent backdrop-blur-md pt-safe px-4 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
              <FaTrophy className="text-yellow-400" size={14} />
            </div>
            <span className="text-white/70 text-xs font-medium">
              LEADERBOARD
            </span>
          </div>
        </div>
      </div>

      <main className="px-4 pb-24 pt-16">
        {/* User Stats Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div
            onClick={() => onNavigate?.("history")}
            className="rounded-xl bg-white/5 backdrop-blur border border-white/10 p-4 cursor-pointer hover:bg-white/10 transition-all"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">
                    {String(user?.firstName || "U")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">
                    {user?.firstName || "Player"}
                  </h3>
                  <p className="text-white/50 text-xs">Your Stats</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-white/90 text-sm border border-white/20 rounded-full px-2 py-1">
                <FaChartLine size={15} />
                <span>View History →</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="text-white font-bold text-lg">
                  {userStats.totalGamesPlayed}
                </div>
                <div className="text-white/50 text-xs uppercase tracking-wider">
                  Played
                </div>
              </div>
              <div className="text-center">
                <div className="text-green-400 font-bold text-lg">
                  {userStats.totalGamesWon}
                </div>
                <div className="text-white/50 text-xs uppercase tracking-wider">
                  Wins
                </div>
              </div>
              <div className="text-center">
                <div className="text-yellow-400 font-bold text-lg">
                  {userStats.winRate}%
                </div>
                <div className="text-white/50 text-xs uppercase tracking-wider">
                  Win Rate
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Leaderboard Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="mb-3">
            <h2 className="text-white font-bold text-sm mb-3">Top Players</h2>
            <div className="flex items-center justify-between gap-1 bg-white/5 rounded-full p-0.5">
              {filterOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setTopFilter(opt.key)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium transition-all ${
                    topFilter === opt.key
                      ? "bg-white/20 text-white"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Leaderboard List */}
          <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
            {leadersLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : leaderboardRows.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
                  <FaTrophy className="text-white/50" size={24} />
                </div>
                <p className="text-white/50 text-xs">No leaderboard data</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {leaderboardRows.slice(0, 20).map((player, index) => {
                  const isTop3 = index < 3;
                  const rank = index + 1;

                  return (
                    <div
                      key={`${player.name}-${index}`}
                      className={`flex items-center justify-between p-3 transition-all ${
                        isTop3 ? "bg-white/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 text-center">
                          {getRankIcon(rank)}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center border border-white/10">
                          <span className="text-white/60 text-xs font-medium">
                            {player.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {player.name}
                          </p>
                          <p className="text-white/50 text-xs">
                            {player.wins} wins
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold text-sm">
                          {player.played}
                        </p>
                        <p className="text-white/50 text-xs">Games</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats Footer */}
          {leaderboardRows.length > 0 && (
            <div className="mt-3 text-center">
              <p className="text-white/20 text-[9px]">
                Showing top {Math.min(leaderboardRows.length, 20)} players
              </p>
            </div>
          )}
        </motion.div>
      </main>

      <BottomNav current="scores" onNavigate={onNavigate} />
    </div>
  );
}
