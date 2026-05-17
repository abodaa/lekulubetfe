import React, { useEffect, useState, useMemo } from "react";
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
  FaCalendarWeek,
  //   FaCalendarMonth,
  FaCalendar,
} from "react-icons/fa";
import { GiMoneyStack, GiCash, GiProfit } from "react-icons/gi";
import { MdPending } from "react-icons/md";

export default function AdminStats() {
  const [allStatsData, setAllStatsData] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [totalMainWallet, setTotalMainWallet] = useState(0);
  const [totalPlayWallet, setTotalPlayWallet] = useState(0);
  const [todayDepositMeta, setTodayDepositMeta] = useState({
    pendingCount: 0,
    pendingTotal: 0,
  });
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
        dailyRes,
        gameHistoryRes,
        depositTotalsRes,
        totalMainRes,
        totalPlayRes,
      ] = await Promise.allSettled([
        apiFetch("/admin/stats/daily?days=365", { timeoutMs: 30000 }),
        apiFetch("/admin/stats/game-history?days=7", { timeoutMs: 20000 }),
        apiFetch(
          `/admin/stats/deposits-total?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          { timeoutMs: 20000 },
        ),
        apiFetch("/admin/stats/wallets/total-main", { timeoutMs: 20000 }),
        apiFetch("/admin/stats/wallets/total-play", { timeoutMs: 20000 }),
      ]);

      let allStats = [];
      if (dailyRes.status === "fulfilled" && dailyRes.value?.days) {
        allStats = dailyRes.value.days;
        // Sort by date ascending (oldest first)
        allStats.sort((a, b) => new Date(a.day) - new Date(b.day));
        setAllStatsData(allStats);
      }

      let nextGameHistory = [];
      if (
        gameHistoryRes.status === "fulfilled" &&
        gameHistoryRes.value?.games
      ) {
        nextGameHistory = gameHistoryRes.value.games;
      }

      const depositTotals =
        depositTotalsRes.status === "fulfilled"
          ? depositTotalsRes.value || {}
          : {};
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

      setGameHistory(nextGameHistory);
      setTodayDepositMeta(nextTodayDepositMeta);
      setTotalMainWallet(nextTotalMain);
      setTotalPlayWallet(nextTotalPlay);
      setIsLoading(false);
    })();
  }, []);

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

  // Process weekly stats
  const processWeeklyStats = (stats) => {
    if (!stats || stats.length === 0) return [];

    const weeks = {};

    stats.forEach((stat) => {
      if (!stat || !stat.day) return;
      const date = new Date(stat.day);
      const weekNumber = getWeekNumber(date);
      const weekKey = `${date.getFullYear()}-W${weekNumber}`;

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
          stakes: new Set(),
        };
      }

      weeks[weekKey].totalGames += stat.totalGames || 0;
      weeks[weekKey].totalPlayers += stat.totalPlayers || 0;
      weeks[weekKey].systemRevenue += stat.systemRevenue || 0;
      weeks[weekKey].totalDeposits += stat.totalDeposits || 0;
      weeks[weekKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes) stat.stakes.forEach((s) => weeks[weekKey].stakes.add(s));
    });

    // Sort weeks by weekKey descending (most recent first)
    return Object.values(weeks)
      .map((week) => ({
        ...week,
        stakesDisplay:
          Array.from(week.stakes)
            .filter((s) => s > 0)
            .sort((a, b) => a - b)
            .map((s) => `ETB ${s}`)
            .join(", ") || "N/A",
      }))
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));
  };

  // Process monthly stats
  const processMonthlyStats = (stats) => {
    if (!stats || stats.length === 0) return [];

    const months = {};

    stats.forEach((stat) => {
      if (!stat || !stat.day) return;
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
          stakes: new Set(),
        };
      }

      months[monthKey].totalGames += stat.totalGames || 0;
      months[monthKey].totalPlayers += stat.totalPlayers || 0;
      months[monthKey].systemRevenue += stat.systemRevenue || 0;
      months[monthKey].totalDeposits += stat.totalDeposits || 0;
      months[monthKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes)
        stat.stakes.forEach((s) => months[monthKey].stakes.add(s));
    });

    // Sort months by monthKey descending (most recent first)
    return Object.values(months)
      .map((month) => ({
        ...month,
        stakesDisplay:
          Array.from(month.stakes)
            .filter((s) => s > 0)
            .sort((a, b) => a - b)
            .map((s) => `ETB ${s}`)
            .join(", ") || "N/A",
      }))
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  };

  // Process yearly stats
  const processYearlyStats = (stats) => {
    if (!stats || stats.length === 0) return [];

    const years = {};

    stats.forEach((stat) => {
      if (!stat || !stat.day) return;
      const date = new Date(stat.day);
      const yearKey = date.getFullYear();

      if (!years[yearKey]) {
        years[yearKey] = {
          year: yearKey,
          totalGames: 0,
          totalPlayers: 0,
          systemRevenue: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          stakes: new Set(),
        };
      }

      years[yearKey].totalGames += stat.totalGames || 0;
      years[yearKey].totalPlayers += stat.totalPlayers || 0;
      years[yearKey].systemRevenue += stat.systemRevenue || 0;
      years[yearKey].totalDeposits += stat.totalDeposits || 0;
      years[yearKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes) stat.stakes.forEach((s) => years[yearKey].stakes.add(s));
    });

    // Sort years descending (most recent first)
    return Object.values(years)
      .map((year) => ({
        ...year,
        stakesDisplay:
          Array.from(year.stakes)
            .filter((s) => s > 0)
            .sort((a, b) => a - b)
            .map((s) => `ETB ${s}`)
            .join(", ") || "N/A",
      }))
      .sort((a, b) => b.year - a.year);
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

  // Helper to check if a date is in the current week
  const isInCurrentWeek = (date) => {
    const now = new Date();
    const currentWeekStart = getStartOfWeek(now);
    const currentWeekEnd = getEndOfWeek(now);
    return date >= currentWeekStart && date <= currentWeekEnd;
  };

  // Helper to check if a date is in the current month
  const isInCurrentMonth = (date) => {
    const now = new Date();
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  };

  // Helper to check if a date is in the current year
  const isInCurrentYear = (date) => {
    const now = new Date();
    return date.getFullYear() === now.getFullYear();
  };

  // Get data for overview cards based on selected period
  const getOverviewData = () => {
    if (!allStatsData || allStatsData.length === 0) {
      return {
        title: "No Data",
        systemRevenue: 0,
        totalPlayers: 0,
        totalGames: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        botWins: 0,
      };
    }

    if (activePeriod === "daily") {
      // Last 7 days
      const last7Days = allStatsData.slice(-7);
      return {
        title: "Last 7 Days",
        systemRevenue: last7Days.reduce(
          (sum, d) => sum + (d.systemRevenue || 0),
          0,
        ),
        totalPlayers: last7Days.reduce(
          (sum, d) => sum + (d.totalPlayers || 0),
          0,
        ),
        totalGames: last7Days.reduce((sum, d) => sum + (d.totalGames || 0), 0),
        totalDeposits: last7Days.reduce(
          (sum, d) => sum + (d.totalDeposits || 0),
          0,
        ),
        totalWithdrawals: last7Days.reduce(
          (sum, d) => sum + (d.totalWithdrawals || 0),
          0,
        ),
        botWins: last7Days.reduce((sum, d) => sum + (d.botGamesWon || 0), 0),
      };
    } else if (activePeriod === "weekly") {
      // Current week - filter stats that fall within current week
      const currentWeekStats = allStatsData.filter((stat) => {
        const statDate = new Date(stat.day);
        return isInCurrentWeek(statDate);
      });

      return {
        title: "This Week",
        systemRevenue: currentWeekStats.reduce(
          (sum, d) => sum + (d.systemRevenue || 0),
          0,
        ),
        totalPlayers: currentWeekStats.reduce(
          (sum, d) => sum + (d.totalPlayers || 0),
          0,
        ),
        totalGames: currentWeekStats.reduce(
          (sum, d) => sum + (d.totalGames || 0),
          0,
        ),
        totalDeposits: currentWeekStats.reduce(
          (sum, d) => sum + (d.totalDeposits || 0),
          0,
        ),
        totalWithdrawals: currentWeekStats.reduce(
          (sum, d) => sum + (d.totalWithdrawals || 0),
          0,
        ),
        botWins: currentWeekStats.reduce(
          (sum, d) => sum + (d.botGamesWon || 0),
          0,
        ),
      };
    } else if (activePeriod === "monthly") {
      // Current month - filter stats that fall within current month
      const currentMonthStats = allStatsData.filter((stat) => {
        const statDate = new Date(stat.day);
        return isInCurrentMonth(statDate);
      });

      return {
        title: "This Month",
        systemRevenue: currentMonthStats.reduce(
          (sum, d) => sum + (d.systemRevenue || 0),
          0,
        ),
        totalPlayers: currentMonthStats.reduce(
          (sum, d) => sum + (d.totalPlayers || 0),
          0,
        ),
        totalGames: currentMonthStats.reduce(
          (sum, d) => sum + (d.totalGames || 0),
          0,
        ),
        totalDeposits: currentMonthStats.reduce(
          (sum, d) => sum + (d.totalDeposits || 0),
          0,
        ),
        totalWithdrawals: currentMonthStats.reduce(
          (sum, d) => sum + (d.totalWithdrawals || 0),
          0,
        ),
        botWins: currentMonthStats.reduce(
          (sum, d) => sum + (d.botGamesWon || 0),
          0,
        ),
      };
    } else {
      // Current year - filter stats that fall within current year
      const currentYearStats = allStatsData.filter((stat) => {
        const statDate = new Date(stat.day);
        return isInCurrentYear(statDate);
      });

      return {
        title: "This Year",
        systemRevenue: currentYearStats.reduce(
          (sum, d) => sum + (d.systemRevenue || 0),
          0,
        ),
        totalPlayers: currentYearStats.reduce(
          (sum, d) => sum + (d.totalPlayers || 0),
          0,
        ),
        totalGames: currentYearStats.reduce(
          (sum, d) => sum + (d.totalGames || 0),
          0,
        ),
        totalDeposits: currentYearStats.reduce(
          (sum, d) => sum + (d.totalDeposits || 0),
          0,
        ),
        totalWithdrawals: currentYearStats.reduce(
          (sum, d) => sum + (d.totalWithdrawals || 0),
          0,
        ),
        botWins: currentYearStats.reduce(
          (sum, d) => sum + (d.botGamesWon || 0),
          0,
        ),
      };
    }
  };

  // Get detailed table data based on selected period
  const getTableData = () => {
    if (!allStatsData || allStatsData.length === 0) return [];

    if (activePeriod === "daily") {
      // Return all stats for daily, sorted descending
      return [...allStatsData].reverse();
    } else if (activePeriod === "weekly") {
      return processWeeklyStats(allStatsData);
    } else if (activePeriod === "monthly") {
      return processMonthlyStats(allStatsData);
    } else {
      return processYearlyStats(allStatsData);
    }
  };

  const overviewData = getOverviewData();
  const tableData = getTableData();
  const tableTitle =
    activePeriod === "daily"
      ? "Daily Statistics"
      : activePeriod === "weekly"
        ? "Weekly Statistics"
        : activePeriod === "monthly"
          ? "Monthly Statistics"
          : "Yearly Statistics";

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
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
        activePeriod === period
          ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
          : "text-white/40 hover:text-white/60 hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      <div className="max-w-md mx-auto px-4 pb-24 pt-4">
        {/* Period Selector Tabs - Top */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur rounded-xl p-1 mb-4"
        >
          <div className="flex gap-1">
            <PeriodButton
              period="daily"
              label="Daily"
              icon={<FaCalendarAlt size={12} />}
            />
            <PeriodButton
              period="weekly"
              label="Weekly"
              icon={<FaCalendarWeek size={12} />}
            />
            <PeriodButton
              period="monthly"
              label="Monthly"
              icon={<FaCalendar size={12} />}
            />
            <PeriodButton
              period="yearly"
              label="Yearly"
              icon={<FaCalendar size={12} />}
            />
          </div>
        </motion.div>

        {/* Overview Cards - Filtered by Period */}
        <motion.div
          key={activePeriod}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <FaChartLine className="text-amber-400" size={12} />
            </div>
            <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
              {overviewData.title} Overview
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<GiProfit size={14} />}
              label="System Revenue"
              value={`ETB ${isLoading ? "..." : overviewData.systemRevenue.toLocaleString()}`}
              color="amber"
            />
            <StatCard
              icon={<FaUsers size={14} />}
              label="Total Players"
              value={
                isLoading ? "..." : overviewData.totalPlayers.toLocaleString()
              }
              color="green"
            />
            <StatCard
              icon={<FaGamepad size={14} />}
              label="Total Games"
              value={
                isLoading ? "..." : overviewData.totalGames.toLocaleString()
              }
              color="blue"
            />
            <StatCard
              icon={<GiCash size={14} />}
              label="Total Deposits"
              value={`ETB ${isLoading ? "..." : overviewData.totalDeposits.toLocaleString()}`}
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
              value={`ETB ${isLoading ? "..." : overviewData.totalWithdrawals.toLocaleString()}`}
              color="red"
            />
            <StatCard
              icon={<FaRobot size={14} />}
              label="Bot Wins"
              value={
                isLoading ? "..." : (overviewData.botWins || 0).toLocaleString()
              }
              color="purple"
            />
          </div>
        </motion.div>

        {/* Wallet Totals - All Time (Static) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
              <FaWallet className="text-purple-400" size={12} />
            </div>
            <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
              Wallet Totals (All Time)
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

        {/* Detailed Statistics Table */}
        <motion.div
          key={`table-${activePeriod}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden mb-4"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              {tableTitle}
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {!isLoading && tableData.length > 0 ? (
              <table className="w-full text-[10px]">
                <thead className="border-b border-white/10 sticky top-0 bg-purple-900/90">
                  <tr>
                    <th className="text-left py-2 px-2 text-white/30 font-medium">
                      {activePeriod === "daily"
                        ? "Date"
                        : activePeriod === "weekly"
                          ? "Week"
                          : activePeriod === "monthly"
                            ? "Month"
                            : "Year"}
                    </th>
                    <th className="text-center py-2 px-2 text-white/30 font-medium">
                      Games
                    </th>
                    <th className="text-center py-2 px-2 text-white/30 font-medium">
                      Players
                    </th>
                    <th className="text-center py-2 px-2 text-white/30 font-medium">
                      Stake
                    </th>
                    <th className="text-right py-2 px-2 text-white/30 font-medium">
                      Revenue
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
                  {tableData.map((stat, index) => (
                    <tr
                      key={index}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      <td className="py-2 px-2 text-white/70 text-[9px]">
                        {activePeriod === "daily"
                          ? new Date(stat.day).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : activePeriod === "weekly"
                            ? `${stat.startDate?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) || ""} - ${stat.endDate?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) || ""}`
                            : activePeriod === "monthly"
                              ? stat.monthName || ""
                              : stat.year || ""}
                      </td>
                      <td className="text-center py-2 px-2 text-white">
                        {stat.totalGames || 0}
                      </td>
                      <td className="text-center py-2 px-2 text-white">
                        {stat.totalPlayers || 0}
                      </td>
                      <td className="text-center py-2 px-2 text-white/60 text-[9px]">
                        {stat.stakesDisplay || "N/A"}
                      </td>
                      <td className="text-right py-2 px-2 text-amber-400">
                        ETB {(stat.systemRevenue || 0).toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-2 text-emerald-400">
                        ETB {(stat.totalDeposits || 0).toFixed(2)}
                      </td>
                      <td className="text-right py-2 px-2 text-red-400">
                        ETB {(stat.totalWithdrawals || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
