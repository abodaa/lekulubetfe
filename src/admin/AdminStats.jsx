import React, { useEffect, useState, useMemo, Fragment } from "react";
import { apiFetch } from "../lib/api/client";
import { motion } from "framer-motion";
import {
  FaTrophy,
  FaUsers,
  FaGamepad,
  FaMoneyBillWave,
  FaWallet,
  FaCoins,
  FaChartLine,
  FaRobot,
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
  FaDollarSign,
  FaPercentage,
} from "react-icons/fa";
import { GiMoneyStack, GiCash, GiProfit } from "react-icons/gi";
import { MdPending, MdTrendingUp, MdTrendingDown } from "react-icons/md";

export default function AdminStats() {
  const [today, setToday] = useState({
    totalPlayers: 0,
    systemCut: 0,
    botWinningsFromRealGames: 0,
  });
  const [dailyStats, setDailyStats] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [todayFinance, setTodayFinance] = useState({
    totalGames: 0,
    totalDeposit: 0,
    totalWithdraw: 0,
  });
  const [todayDepositMeta, setTodayDepositMeta] = useState({
    pendingCount: 0,
    pendingTotal: 0,
  });
  const [totalMainWallet, setTotalMainWallet] = useState(0);
  const [totalPlayWallet, setTotalPlayWallet] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);

      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const addisAbabaTime = new Date(utcTime + 3 * 3600000);

      const start = new Date(addisAbabaTime);
      start.setHours(0, 0, 0, 0);
      const startUTC = new Date(start.getTime() - 3 * 3600000);

      const end = new Date(addisAbabaTime);
      end.setHours(23, 59, 59, 999);
      const endUTC = new Date(end.getTime() - 3 * 3600000);

      const from = startUTC.toISOString();
      const to = endUTC.toISOString();

      const [
        todayRes,
        dailyRes,
        gameHistoryRes,
        overviewRes,
        depositTotalsRes,
        withdrawalsCompletedRes,
        totalMainRes,
        totalPlayRes,
      ] = await Promise.allSettled([
        apiFetch("/admin/stats/today", { timeoutMs: 15000 }),
        apiFetch("/admin/stats/daily?days=14", { timeoutMs: 30000 }),
        apiFetch("/admin/stats/game-history?days=2", { timeoutMs: 20000 }),
        apiFetch("/admin/stats/overview", { timeoutMs: 20000 }),
        apiFetch(
          `/admin/stats/deposits-total?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { timeoutMs: 20000 },
        ),
        apiFetch("/admin/balances/withdrawals?status=completed", {
          timeoutMs: 20000,
        }),
        apiFetch("/admin/stats/wallets/total-main", { timeoutMs: 20000 }),
        apiFetch("/admin/stats/wallets/total-play", { timeoutMs: 20000 }),
      ]);

      const nextToday =
        todayRes.status === "fulfilled"
          ? {
              totalPlayers: todayRes.value?.totalPlayers || 0,
              systemCut: todayRes.value?.systemCut || 0,
              botWinningsFromRealGames:
                todayRes.value?.botWinningsFromRealGames || 0,
            }
          : { totalPlayers: 0, systemCut: 0, botWinningsFromRealGames: 0 };

      let nextDailyStats = [];
      if (dailyRes.status === "fulfilled") {
        nextDailyStats = dailyRes.value?.days || [];
      }

      let nextGameHistory = [];
      if (gameHistoryRes.status === "fulfilled") {
        nextGameHistory = gameHistoryRes.value?.games || [];
      }

      const overview =
        overviewRes.status === "fulfilled" ? overviewRes.value : null;
      const depositTotals =
        depositTotalsRes.status === "fulfilled"
          ? depositTotalsRes.value || {}
          : {};
      const withdrawalsCompleted =
        withdrawalsCompletedRes.status === "fulfilled"
          ? withdrawalsCompletedRes.value?.withdrawals || []
          : [];

      const totalGames = overview?.today?.totalGames || 0;
      const totalDeposit = Number(depositTotals.completedTotal) || 0;

      const totalWithdraw = withdrawalsCompleted
        .filter((w) => {
          const processedDate = w.processedBy?.processedAt || w.processedAt;
          return (
            processedDate &&
            new Date(processedDate) >= startUTC &&
            new Date(processedDate) <= endUTC
          );
        })
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      const nextTodayFinance = { totalGames, totalDeposit, totalWithdraw };
      const nextTodayDepositMeta = {
        pendingCount: Number(depositTotals.pendingCount) || 0,
        pendingTotal: Number(depositTotals.pendingTotal) || 0,
      };
      const nextTotalMain =
        totalMainRes.status === "fulfilled"
          ? totalMainRes.value?.totalMain || 0
          : 0;
      const nextTotalPlay =
        totalPlayRes.status === "fulfilled"
          ? totalPlayRes.value?.totalPlay || 0
          : 0;

      setToday(nextToday);
      setDailyStats(nextDailyStats);
      setGameHistory(nextGameHistory);
      setTodayFinance(nextTodayFinance);
      setTodayDepositMeta(nextTodayDepositMeta);
      setTotalMainWallet(nextTotalMain);
      setTotalPlayWallet(nextTotalPlay);
      setIsLoading(false);
    })();
  }, []);

  const weeklyStats = dailyStats.slice(0, 7);

  const groupedGameHistory = useMemo(() => {
    if (!Array.isArray(gameHistory) || gameHistory.length === 0) {
      return [];
    }

    const byDate = {};

    gameHistory.forEach((game) => {
      if (!game || !game.finishedAt) return;

      const finished = new Date(game.finishedAt);
      if (Number.isNaN(finished.getTime())) return;

      const dateKey = finished.toISOString().slice(0, 10);
      const dateLabel = finished.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      if (!byDate[dateKey]) {
        byDate[dateKey] = {
          dateKey,
          dateLabel,
          netRevenueSum: 0,
          games: [],
        };
      }

      const net = typeof game.netRevenue === "number" ? game.netRevenue : 0;
      byDate[dateKey].netRevenueSum += net;
      byDate[dateKey].games.push(game);
    });

    return Object.values(byDate).sort((a, b) =>
      a.dateKey < b.dateKey ? 1 : -1,
    );
  }, [gameHistory]);

  const StatCard = ({ icon, label, value, color = "blue", subtext = null }) => {
    const colorClasses = {
      blue: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
      green: "from-emerald-500/20 to-green-600/20 border-emerald-500/30",
      amber: "from-amber-500/20 to-orange-600/20 border-amber-500/30",
      red: "from-red-500/20 to-rose-600/20 border-red-500/30",
      purple: "from-purple-500/20 to-pink-600/20 border-purple-500/30",
      cyan: "from-cyan-500/20 to-blue-600/20 border-cyan-500/30",
    };
    const textColors = {
      blue: "text-blue-400",
      green: "text-emerald-400",
      amber: "text-amber-400",
      red: "text-red-400",
      purple: "text-purple-400",
      cyan: "text-cyan-400",
    };

    return (
      <div
        className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur rounded-xl border p-3`}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="text-white/40 text-[10px] uppercase tracking-wider">
            {label}
          </div>
          <div className={textColors[color]}>{icon}</div>
        </div>
        <div
          className={`text-white text-xl font-bold ${value === "..." ? "text-white/50" : ""}`}
        >
          {value}
        </div>
        {subtext && (
          <div className="text-white/30 text-[9px] mt-1">{subtext}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        {/* Today's Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <FaChartLine className="text-amber-400" size={12} />
            </div>
            <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
              Today's Overview
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<GiProfit size={14} />}
              label="System Revenue"
              value={`ETB ${isLoading ? "..." : today.systemCut.toLocaleString()}`}
              color="amber"
            />
            <StatCard
              icon={<FaUsers size={14} />}
              label="Total Players"
              value={isLoading ? "..." : today.totalPlayers.toLocaleString()}
              color="green"
            />
            <StatCard
              icon={<FaGamepad size={14} />}
              label="Total Games"
              value={
                isLoading ? "..." : todayFinance.totalGames.toLocaleString()
              }
              color="blue"
            />
            <StatCard
              icon={<GiCash size={14} />}
              label="Total Deposits"
              value={`ETB ${isLoading ? "..." : todayFinance.totalDeposit.toLocaleString()}`}
              color="green"
              subtext={
                !isLoading
                  ? `Pending: ${todayDepositMeta.pendingCount} (ETB ${todayDepositMeta.pendingTotal.toFixed(2)})`
                  : null
              }
            />
            <StatCard
              icon={<FaMoneyBillWave size={14} />}
              label="Total Withdrawals"
              value={`ETB ${isLoading ? "..." : todayFinance.totalWithdraw.toLocaleString()}`}
              color="red"
            />
            <StatCard
              icon={<FaRobot size={14} />}
              label="Bot Wins"
              value={
                isLoading
                  ? "..."
                  : (today.botWinningsFromRealGames || 0).toLocaleString()
              }
              color="purple"
            />
          </div>
        </motion.div>

        {/* Wallet Totals */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
              <FaWallet className="text-purple-400" size={12} />
            </div>
            <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
              Wallet Totals
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<GiMoneyStack size={14} />}
              label="Main Wallet"
              value={`ETB ${isLoading ? "..." : totalMainWallet.toFixed(2)}`}
              color="blue"
            />
            <StatCard
              icon={<FaCoins size={14} />}
              label="Play Wallet"
              value={`ETB ${isLoading ? "..." : totalPlayWallet.toFixed(2)}`}
              color="cyan"
            />
          </div>
        </motion.div>

        {/* Daily Statistics Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden mb-4"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              Daily Statistics
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left py-2 px-2 text-white/30 font-medium">
                    Day
                  </th>
                  <th className="text-center py-2 px-2 text-white/30 font-medium">
                    Games
                  </th>
                  <th className="text-center py-2 px-2 text-white/30 font-medium">
                    Stake
                  </th>
                  <th className="text-center py-2 px-2 text-white/30 font-medium">
                    Players
                  </th>
                  <th className="text-right py-2 px-2 text-white/30 font-medium">
                    Revenue
                  </th>
                  <th className="text-center py-2 px-2 text-white/30 font-medium">
                    Bot Wins
                  </th>
                  <th className="text-right py-2 px-2 text-white/30 font-medium">
                    Deposits
                  </th>
                  <th className="text-right py-2 px-2 text-white/30 font-medium">
                    Withdrawals
                  </th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && weeklyStats.length > 0 ? (
                  weeklyStats.map((stat, index) => (
                    <tr
                      key={index}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="py-2 px-2 text-white">
                        {new Date(stat.day).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="text-center py-2 px-2 text-white">
                        {stat.totalGames || 0}
                      </td>
                      <td className="text-center py-2 px-2 text-white/60 text-[9px]">
                        {stat.stakesDisplay}
                      </td>
                      <td className="text-center py-2 px-2 text-white">
                        {stat.totalPlayers || 0}
                      </td>
                      <td className="text-right py-2 px-2 text-amber-400">
                        ETB {(stat.systemRevenue || 0).toFixed(2)}
                      </td>
                      <td className="text-center py-2 px-2 text-white">
                        {stat.botGamesWon || 0}
                      </td>
                      <td className="text-right py-2 px-2 text-emerald-400">
                        ETB {(stat.totalDeposits || 0).toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-400">
                        ETB {(stat.totalWithdrawals || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-white/30 text-xs"
                    >
                      {isLoading ? "Loading..." : "No data available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Game History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              Game History (Last 2 Days)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {!isLoading && groupedGameHistory.length > 0 ? (
              groupedGameHistory.map((group, idx) => (
                <div key={group.dateKey}>
                  <div className="px-2 py-2 bg-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-[9px]">
                        {group.dateLabel}
                      </span>
                      <span className="text-amber-400 text-[9px] font-medium">
                        Net: ETB {group.netRevenueSum.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-[9px]">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="text-left py-1 px-2 text-white/30 font-medium">
                          Game ID
                        </th>
                        <th className="text-center py-1 px-2 text-white/30 font-medium">
                          Players
                        </th>
                        <th className="text-center py-1 px-2 text-white/30 font-medium">
                          Stake
                        </th>
                        <th className="text-right py-1 px-2 text-white/30 font-medium">
                          Prize
                        </th>
                        <th className="text-right py-1 px-2 text-white/30 font-medium">
                          System Cut
                        </th>
                        <th className="text-center py-1 px-2 text-white/30 font-medium">
                          Winner
                        </th>
                        <th className="text-right py-1 px-2 text-white/30 font-medium">
                          Net
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.games.map((game, gameIdx) => (
                        <tr
                          key={game.gameId || gameIdx}
                          className="border-b border-white/5 hover:bg-white/5"
                        >
                          <td className="py-1 px-2 text-white/60 font-mono text-[8px]">
                            {game.gameId?.slice(-6) || "—"}
                          </td>
                          <td className="text-center py-1 px-2 text-white">
                            {game.totalPlayers ?? 0}
                          </td>
                          <td className="text-center py-1 px-2 text-white">
                            ETB {game.stake ?? 0}
                          </td>
                          <td className="text-right py-1 px-2 text-emerald-400">
                            ETB {(game.prizePool ?? 0).toFixed(2)}
                          </td>
                          <td className="text-right py-1 px-2 text-amber-400">
                            ETB {(game.systemRevenue ?? 0).toFixed(2)}
                          </td>
                          <td className="text-center py-1 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${
                                game.whoWon === "Real"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : game.whoWon === "Bot"
                                    ? "bg-purple-500/20 text-purple-400"
                                    : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {game.whoWon || "—"}
                            </span>
                          </td>
                          <td className="text-right py-1 px-2 text-cyan-400">
                            ETB {(game.netRevenue ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-white/30 text-xs">
                  {isLoading ? "Loading..." : "No game history for last 2 days"}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
