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
  FaCalendarWeek,
  FaCalendarMonth,
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
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState([]);
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
  const [activePeriod, setActivePeriod] = useState("daily");
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
        apiFetch("/admin/stats/daily?days=30", { timeoutMs: 30000 }),
        apiFetch("/admin/stats/game-history?days=7", { timeoutMs: 20000 }),
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

      let allStats = [];
      if (dailyRes.status === "fulfilled") {
        allStats = dailyRes.value?.days || [];
      }

      // Process daily stats (last 7 days)
      const daily = allStats.slice(0, 7);

      // Process weekly stats (group by week)
      const weekly = processWeeklyStats(allStats);

      // Process monthly stats (group by month)
      const monthly = processMonthlyStats(allStats);

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
      setDailyStats(daily);
      setWeeklyStats(weekly);
      setMonthlyStats(monthly);
      setGameHistory(nextGameHistory);
      setTodayFinance(nextTodayFinance);
      setTodayDepositMeta(nextTodayDepositMeta);
      setTotalMainWallet(nextTotalMain);
      setTotalPlayWallet(nextTotalPlay);
      setIsLoading(false);
    })();
  }, []);

  const processWeeklyStats = (stats) => {
    const weeks = {};

    stats.forEach((stat) => {
      const date = new Date(stat.day);
      const year = date.getFullYear();
      const weekNumber = getWeekNumber(date);
      const weekKey = `${year}-W${weekNumber}`;

      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          weekKey,
          startDate: getStartOfWeek(date),
          endDate: getEndOfWeek(date),
          totalGames: 0,
          totalPlayers: 0,
          systemRevenue: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          stakeSet: new Set(),
          stats: [],
        };
      }

      weeks[weekKey].totalGames += stat.totalGames || 0;
      weeks[weekKey].totalPlayers += stat.totalPlayers || 0;
      weeks[weekKey].systemRevenue += stat.systemRevenue || 0;
      weeks[weekKey].totalDeposits += stat.totalDeposits || 0;
      weeks[weekKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes)
        stat.stakes.forEach((s) => weeks[weekKey].stakeSet.add(s));
      weeks[weekKey].stats.push(stat);
    });

    return Object.values(weeks)
      .map((week) => ({
        ...week,
        stakesDisplay:
          Array.from(week.stakeSet)
            .filter((s) => s > 0)
            .sort((a, b) => a - b)
            .map((s) => `ETB ${s}`)
            .join(", ") || "N/A",
      }))
      .reverse();
  };

  const processMonthlyStats = (stats) => {
    const months = {};

    stats.forEach((stat) => {
      const date = new Date(stat.day);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const monthName = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      });

      if (!months[monthKey]) {
        months[monthKey] = {
          monthKey,
          monthName,
          totalGames: 0,
          totalPlayers: 0,
          systemRevenue: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          stakeSet: new Set(),
          stats: [],
        };
      }

      months[monthKey].totalGames += stat.totalGames || 0;
      months[monthKey].totalPlayers += stat.totalPlayers || 0;
      months[monthKey].systemRevenue += stat.systemRevenue || 0;
      months[monthKey].totalDeposits += stat.totalDeposits || 0;
      months[monthKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes)
        stat.stakes.forEach((s) => months[monthKey].stakeSet.add(s));
      months[monthKey].stats.push(stat);
    });

    return Object.values(months)
      .map((month) => ({
        ...month,
        stakesDisplay:
          Array.from(month.stakeSet)
            .filter((s) => s > 0)
            .sort((a, b) => a - b)
            .map((s) => `ETB ${s}`)
            .join(", ") || "N/A",
      }))
      .reverse();
  };

  const getWeekNumber = (date) => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  };

  const getEndOfWeek = (date) => {
    const start = getStartOfWeek(date);
    return new Date(start.setDate(start.getDate() + 6));
  };

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

  const currentStats =
    activePeriod === "daily"
      ? dailyStats
      : activePeriod === "weekly"
        ? weeklyStats
        : monthlyStats;

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

  const PeriodButton = ({ period, label, icon }) => (
    <button
      onClick={() => setActivePeriod(period)}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
        activePeriod === period
          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
          : "text-white/40 hover:text-white/60"
      }`}
    >
      {icon}
      {label}
    </button>
  );

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

        {/* Period Selector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur rounded-xl p-1 mb-4"
        >
          <div className="flex gap-1">
            <PeriodButton
              period="daily"
              label="Daily"
              icon={<FaCalendarAlt size={10} />}
            />
            <PeriodButton
              period="weekly"
              label="Weekly"
              icon={<FaCalendarWeek size={10} />}
            />
            <PeriodButton
              period="monthly"
              label="Monthly"
              icon={<FaCalendarMonth size={10} />}
            />
          </div>
        </motion.div>

        {/* Statistics Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden mb-4"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              {activePeriod === "daily"
                ? "Daily Statistics"
                : activePeriod === "weekly"
                  ? "Weekly Statistics"
                  : "Monthly Statistics"}
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {!isLoading && currentStats.length > 0 ? (
              currentStats.map((stat, index) => (
                <div key={index}>
                  <div className="px-2 py-2 bg-white/5 sticky top-0">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-[9px]">
                        {activePeriod === "daily"
                          ? new Date(stat.day).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : activePeriod === "weekly"
                            ? `${stat.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${stat.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                            : stat.monthName}
                      </span>
                      <span className="text-amber-400 text-[9px] font-medium">
                        Revenue: ETB {(stat.systemRevenue || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <table className="w-full text-[10px]">
                    <thead className="border-b border-white/5">
                      <tr>
                        <th className="text-left py-1.5 px-2 text-white/30 font-medium">
                          Metric
                        </th>
                        <th className="text-right py-1.5 px-2 text-white/30 font-medium">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5">
                        <td className="py-1.5 px-2 text-white/60">
                          Games Played
                        </td>
                        <td className="text-right py-1.5 px-2 text-white">
                          {stat.totalGames || 0}
                        </td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-1.5 px-2 text-white/60">
                          Total Players
                        </td>
                        <td className="text-right py-1.5 px-2 text-white">
                          {stat.totalPlayers || 0}
                        </td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-1.5 px-2 text-white/60">Stakes</td>
                        <td className="text-right py-1.5 px-2 text-white/60 text-[9px]">
                          {stat.stakesDisplay}
                        </td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-1.5 px-2 text-white/60">
                          System Revenue
                        </td>
                        <td className="text-right py-1.5 px-2 text-amber-400">
                          ETB {(stat.systemRevenue || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-b border-white/5">
                        <td className="py-1.5 px-2 text-white/60">
                          Total Deposits
                        </td>
                        <td className="text-right py-1.5 px-2 text-emerald-400">
                          ETB {(stat.totalDeposits || 0).toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 text-white/60">
                          Total Withdrawals
                        </td>
                        <td className="text-right py-1.5 px-2 text-red-400">
                          ETB {(stat.totalWithdrawals || 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-white/30 text-xs">
                  {isLoading ? "Loading..." : "No data available"}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Game History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              Game History (Last 7 Days)
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {!isLoading && groupedGameHistory.length > 0 ? (
              groupedGameHistory.map((group, idx) => (
                <div key={group.dateKey}>
                  <div className="px-2 py-2 bg-white/5 sticky top-0">
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
                  {isLoading ? "Loading..." : "No game history available"}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
