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
  FaCalendarAlt,
  FaCalendarWeek,
  //   FaCalendarMonth,
  FaCalendar,
} from "react-icons/fa";
import { GiMoneyStack, GiCash, GiProfit, GiRobotGolem } from "react-icons/gi";
import { MdPending } from "react-icons/md";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

export default function AdminStats() {
  const [dailyStats, setDailyStats] = useState([]);
  const [gameHistory, setGameHistory] = useState([]);
  const [totalMainWallet, setTotalMainWallet] = useState(0);
  const [totalBonusWallet, setTotalBonusWallet] = useState(0);
  const [todayDepositMeta, setTodayDepositMeta] = useState({
    pendingCount: 0,
    pendingTotal: 0,
  });
  const [todayData, setTodayData] = useState({
    systemRevenue: 0,
    totalPlayers: 0,
    totalGames: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
  });
  const [activePeriod, setActivePeriod] = useState("daily");
  const [peakTimes, setPeakTimes] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Per-period summary — fetched from the server for ONLY the selected range,
  // so switching filters fetches fresh (no 90-day prefetch, no client slicing).
  const [summary, setSummary] = useState({
    systemRevenue: 0,
    realStakeIn: 0,
    bonusWagered: 0,
    prizesOut: 0,
    botWinnings: 0,
    botStakeIn: 0,
    botBetsCount: 0,
    botCartellas: 0,
    realRevenue: 0,
    totalPlayers: 0,
    totalGames: 0,
    totalCartellas: 0,
    cartellasByStake: {},
    totalDeposits: 0,
    totalWithdrawals: 0,
    approvedWithdrawals: 0,
    approvedWithdrawalsCount: 0,
    pendingWithdrawals: 0,
    pendingWithdrawalsCount: 0,
    cancelledWithdrawals: 0,
    cancelledWithdrawalsCount: 0,
    failedWithdrawals: 0,
    failedWithdrawalsCount: 0,
    processingWithdrawals: 0,
    processingWithdrawalsCount: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);

  const periodToRange = {
    daily: "today",
    weekly: "week",
    monthly: "month",
    yearly: "all",
    all: "all",
  };

  const fetchSummary = async (period) => {
    const range = periodToRange[period] || "all";
    setSummaryLoading(true);
    try {
      const res = await apiFetch(`/admin/stats/summary?range=${range}`);
      setSummary({
        systemRevenue: res?.systemRevenue || 0,
        realStakeIn: res?.realStakeIn || 0,
        bonusWagered: res?.bonusWagered || 0,
        prizesOut: res?.prizesOut || 0,
        botWinnings: res?.botWinnings || 0,
        botStakeIn: res?.botStakeIn || 0,
        botBetsCount: res?.botBetsCount || 0,
        botCartellas: res?.botCartellas || 0,
        realRevenue: res?.realRevenue || 0,
        totalPlayers: res?.totalPlayers || 0,
        totalGames: res?.totalGames || 0,
        totalCartellas: res?.totalCartellas || 0,
        cartellasByStake: res?.cartellasByStake || {},
        totalDeposits: res?.totalDeposits || 0,
        totalWithdrawals: res?.totalWithdrawals || 0,
        approvedWithdrawals: res?.approvedWithdrawals || 0,
        approvedWithdrawalsCount: res?.approvedWithdrawalsCount || 0,
        pendingWithdrawals: res?.pendingWithdrawals || 0,
        pendingWithdrawalsCount: res?.pendingWithdrawalsCount || 0,
        cancelledWithdrawals: res?.cancelledWithdrawals || 0,
        cancelledWithdrawalsCount: res?.cancelledWithdrawalsCount || 0,
        failedWithdrawals: res?.failedWithdrawals || 0,
        failedWithdrawalsCount: res?.failedWithdrawalsCount || 0,
        processingWithdrawals: res?.processingWithdrawals || 0,
        processingWithdrawalsCount: res?.processingWithdrawalsCount || 0,
      });
    } catch (e) {
      console.error("summary fetch failed", e);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Fetch the summary for the selected period: today on mount, and again on
  // every filter change.
  useEffect(() => {
    fetchSummary(activePeriod);
  }, [activePeriod]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setIsLoading(true);

    try {
      // Fetch daily stats
      const dailyRes = await apiFetch("/admin/stats/daily?days=90").catch(
        () => ({ days: [] }),
      );
      const allStats = dailyRes?.days || [];
      allStats.sort((a, b) => new Date(a.day) - new Date(b.day));
      setDailyStats(allStats);

      // Fetch game history
      const gameHistoryRes = await apiFetch(
        "/admin/stats/game-history?days=7",
      ).catch(() => ({ games: [] }));
      setGameHistory(gameHistoryRes?.games || []);

      // Fetch peak activity (hour-of-day & day-of-week), last 30 days
      const peakRes = await apiFetch("/admin/stats/peak-times?days=30").catch(
        () => null,
      );
      setPeakTimes(peakRes || null);

      // Fetch wallet totals
      const [totalMainRes, totalBonusRes] = await Promise.all([
        apiFetch("/admin/stats/wallets/total-main").catch(() => ({
          totalMain: 0,
        })),
        apiFetch("/admin/stats/wallets/total-bonus").catch(() => ({
          totalBonus: 0,
        })),
      ]);
      setTotalMainWallet(totalMainRes?.totalMain || 0);
      setTotalBonusWallet(totalBonusRes?.totalBonus || 0);

      // Fetch today's overview
      const todayRes = await apiFetch("/admin/stats/today").catch(() => ({
        totalPlayers: 0,
        systemCut: 0,
        botWinningsFromRealGames: 0,
      }));
      const overviewRes = await apiFetch("/admin/stats/overview").catch(() => ({
        today: { totalGames: 0 },
      }));

      // Fetch pending deposits
      const now = new Date();
      const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
      const addisAbabaTime = new Date(utcTime + 3 * 3600000);
      const start = new Date(addisAbabaTime);
      start.setHours(0, 0, 0, 0);
      const startUTC = new Date(start.getTime() - 3 * 3600000);
      const end = new Date(addisAbabaTime);
      end.setHours(23, 59, 59, 999);
      const endUTC = new Date(end.getTime() - 3 * 3600000);

      const depositTotals = await apiFetch(
        `/admin/stats/deposits-total?from=${startUTC.toISOString()}&to=${endUTC.toISOString()}`,
      ).catch(() => ({}));
      setTodayDepositMeta({
        pendingCount: depositTotals?.pendingCount || 0,
        pendingTotal: depositTotals?.pendingTotal || 0,
      });

      // Set today's data for daily view
      setTodayData({
        systemRevenue: todayRes?.systemCut || 0,
        totalPlayers: todayRes?.totalPlayers || 0,
        totalGames: overviewRes?.today?.totalGames || 0,
        totalDeposits: depositTotals?.completedTotal || 0,
        totalWithdrawals: 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate data for selected period from dailyStats
  const getFilteredData = () => {
    if (!dailyStats.length) return todayData;

    const slice =
      activePeriod === "daily"
        ? dailyStats.slice(-1) // today only
        : activePeriod === "weekly"
          ? dailyStats.slice(-7)
          : activePeriod === "monthly"
            ? dailyStats.slice(-30)
            : dailyStats; // yearly / all-time (within fetched window)

    const sum = (k) => slice.reduce((s, d) => s + (Number(d[k]) || 0), 0);

    return {
      systemRevenue: sum("systemRevenue"), // nominal game cut (20%)
      realStakeIn: sum("realStakeIn"), // real cash staked
      bonusWagered: sum("bonusWagered"), // promo money staked
      prizesOut: sum("prizesOut"), // real prizes paid out
      realRevenue: sum("realRevenue"), // realStakeIn - prizesOut
      totalPlayers: sum("totalPlayers"),
      totalGames: sum("totalGames"),
      totalDeposits: sum("totalDeposits"),
      totalWithdrawals: sum("totalWithdrawals"),
    };
  };

  // Headline numbers come from the per-period server summary (correct + fast).
  // getFilteredData()/dailyStats remain only for the per-day breakdown table.
  const overviewData = summary;

  // Precise money formatter: thousands separators + exactly 2 decimals.
  const money = (n) =>
    Number(n || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const getPeriodTitle = () => {
    if (activePeriod === "daily") return "Today";
    if (activePeriod === "weekly") return "This Week";
    if (activePeriod === "monthly") return "This Month";
    return "All Time";
  };

  // Process weekly stats for table display
  const processWeeklyStats = (stats) => {
    if (!stats || stats.length === 0) return [];

    const weeks = {};

    stats.forEach((stat) => {
      if (!stat || !stat.day) return;
      const date = new Date(stat.day);
      const weekKey = getWeekKey(date);

      if (!weeks[weekKey]) {
        weeks[weekKey] = {
          weekKey,
          startDate: getStartOfWeek(date),
          endDate: getEndOfWeek(date),
          totalGames: 0,
          totalPlayers: 0,
          systemRevenue: 0,
          realRevenue: 0,
          bonusWagered: 0,
          prizesOut: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          stakes: new Set(),
        };
      }

      weeks[weekKey].totalGames += stat.totalGames || 0;
      weeks[weekKey].totalPlayers += stat.totalPlayers || 0;
      weeks[weekKey].systemRevenue += stat.systemRevenue || 0;
      weeks[weekKey].realRevenue += stat.realRevenue || 0;
      weeks[weekKey].bonusWagered += stat.bonusWagered || 0;
      weeks[weekKey].prizesOut += stat.prizesOut || 0;
      weeks[weekKey].totalDeposits += stat.totalDeposits || 0;
      weeks[weekKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes) stat.stakes.forEach((s) => weeks[weekKey].stakes.add(s));
    });

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

  // Process monthly stats for table display
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
          realRevenue: 0,
          bonusWagered: 0,
          prizesOut: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          stakes: new Set(),
        };
      }

      months[monthKey].totalGames += stat.totalGames || 0;
      months[monthKey].totalPlayers += stat.totalPlayers || 0;
      months[monthKey].systemRevenue += stat.systemRevenue || 0;
      months[monthKey].realRevenue += stat.realRevenue || 0;
      months[monthKey].bonusWagered += stat.bonusWagered || 0;
      months[monthKey].prizesOut += stat.prizesOut || 0;
      months[monthKey].totalDeposits += stat.totalDeposits || 0;
      months[monthKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes)
        stat.stakes.forEach((s) => months[monthKey].stakes.add(s));
    });

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

  // Process yearly stats for table display
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
          realRevenue: 0,
          bonusWagered: 0,
          prizesOut: 0,
          totalDeposits: 0,
          totalWithdrawals: 0,
          stakes: new Set(),
        };
      }

      years[yearKey].totalGames += stat.totalGames || 0;
      years[yearKey].totalPlayers += stat.totalPlayers || 0;
      years[yearKey].systemRevenue += stat.systemRevenue || 0;
      years[yearKey].realRevenue += stat.realRevenue || 0;
      years[yearKey].bonusWagered += stat.bonusWagered || 0;
      years[yearKey].prizesOut += stat.prizesOut || 0;
      years[yearKey].totalDeposits += stat.totalDeposits || 0;
      years[yearKey].totalWithdrawals += stat.totalWithdrawals || 0;
      if (stat.stakes) stat.stakes.forEach((s) => years[yearKey].stakes.add(s));
    });

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

  const getWeekKey = (date) => {
    const d = new Date(date);
    const weekNumber = getWeekNumber(d);
    return `${d.getFullYear()}-W${weekNumber}`;
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

  // Get table data based on selected period
  const getCurrentTableData = () => {
    if (activePeriod === "daily") {
      return [...dailyStats].reverse();
    } else if (activePeriod === "weekly") {
      return processWeeklyStats(dailyStats);
    } else if (activePeriod === "monthly") {
      return processMonthlyStats(dailyStats);
    } else {
      return processYearlyStats(dailyStats);
    }
  };

  const currentTableData = getCurrentTableData();
  const tableTitle =
    activePeriod === "daily"
      ? "Daily Statistics"
      : activePeriod === "weekly"
        ? "Weekly Statistics"
        : activePeriod === "monthly"
          ? "Monthly Statistics"
          : "Yearly Statistics";

  const formatHour = (h) => {
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr} ${h < 12 ? "AM" : "PM"}`;
  };
  const formatHourShort = (h) =>
    `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "a" : "p"}`;

  const PeakTooltip = ({ active, payload }) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border border-white/10 bg-[#0e1830] px-3 py-2 shadow-lg">
        <p className="text-white text-xs font-semibold">{d.full}</p>
        <p className="text-amber-400 text-[11px]">{d.games} games</p>
        <p className="text-white/60 text-[11px]">{d.players} players</p>
      </div>
    );
  };

  const PeakChart = ({ data, xInterval = 0 }) => (
    <div className="h-40 -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            interval={xInterval}
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 9 }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            width={24}
            tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            content={<PeakTooltip />}
          />
          <Bar dataKey="games" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isPeak ? "#34d399" : "#f59e0b"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const StatCard = ({ icon, label, value, color = "blue", subtext = null }) => {
    const colorClasses = {
      blue: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
      green: "from-emerald-500/20 to-green-600/20 border-emerald-500/30",
      amber: "from-amber-500/20 to-orange-600/20 border-amber-500/30",
      red: "from-red-500/20 to-rose-600/20 border-red-500/30",
      purple: "from-amber-500/20 to-emerald-600/20 border-amber-400/30",
      cyan: "from-cyan-500/20 to-blue-600/20 border-cyan-500/30",
    };
    const textColors = {
      blue: "text-blue-400",
      green: "text-emerald-400",
      amber: "text-amber-400",
      red: "text-red-400",
      purple: "text-amber-400",
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
          ? "bg-white/30 text-white shadow-lg"
          : "text-white/40 hover:text-white/60 hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(110%_70%_at_50%_0%,#16243f_0%,transparent_55%),linear-gradient(180deg,#0e1830_0%,#0a0f1c_55%,#06080f_100%)]">
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
              {getPeriodTitle()} Overview
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {/* Real Revenue — the true bottom line. Accounts for bonus money:
                real cash wagered from Main minus actual prizes paid to winners.
                Nominal "Game Cut" overstates profit because bonus-funded bets
                still pay real winnings. */}
            {(() => {
              const rr = Number(overviewData.realRevenue || 0);
              const gross = Number(overviewData.systemRevenue || 0);
              const staked = Number(overviewData.realStakeIn || 0);
              const bonus = Number(overviewData.bonusWagered || 0);
              const prizes = Number(overviewData.prizesOut || 0);
              const totalWagered = staked + bonus;
              const positive = rr >= 0;
              return (
                <div
                  className={`col-span-2 bg-gradient-to-br ${
                    positive
                      ? "from-emerald-500/25 to-green-600/15 border-emerald-400/40"
                      : "from-red-500/25 to-rose-600/15 border-red-400/40"
                  } backdrop-blur rounded-2xl border p-4`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-white/60 text-[11px] uppercase tracking-wider font-semibold">
                      Real Revenue · {getPeriodTitle()}
                    </div>
                    <div
                      className={positive ? "text-emerald-300" : "text-red-300"}
                    >
                      <GiProfit size={18} />
                    </div>
                  </div>
                  <div
                    className={`text-3xl font-bold ${
                      summaryLoading
                        ? "text-white/50"
                        : positive
                          ? "text-emerald-300"
                          : "text-red-300"
                    }`}
                  >
                    {summaryLoading ? "..." : `ETB ${money(rr)}`}
                  </div>
                  <div className="text-white/40 text-[10px] mt-1">
                    Real cash staked (Main) minus prizes actually paid to
                    winners. Bonus wagered isn&apos;t income, but any prize it
                    funds is still real cash out.
                  </div>
                  {!summaryLoading && (
                    <>
                      {/* The exact equation behind the headline number. */}
                      <div className="mt-3 flex items-stretch gap-1.5 text-center">
                        <div className="flex-1 bg-black/20 rounded-lg py-1.5">
                          <div className="text-emerald-300 text-sm font-semibold">
                            ETB {money(staked)}
                          </div>
                          <div className="text-white/40 text-[8px] uppercase tracking-wide">
                            Real Staked
                          </div>
                        </div>
                        <div className="flex items-center text-white/40 text-sm font-bold">
                          −
                        </div>
                        <div className="flex-1 bg-black/20 rounded-lg py-1.5">
                          <div className="text-red-300 text-sm font-semibold">
                            ETB {money(prizes)}
                          </div>
                          <div className="text-white/40 text-[8px] uppercase tracking-wide">
                            Prizes Paid
                          </div>
                        </div>
                        <div className="flex items-center text-white/40 text-sm font-bold">
                          =
                        </div>
                        <div className="flex-1 bg-black/20 rounded-lg py-1.5">
                          <div
                            className={`text-sm font-semibold ${
                              positive ? "text-emerald-300" : "text-red-300"
                            }`}
                          >
                            ETB {money(rr)}
                          </div>
                          <div className="text-white/40 text-[8px] uppercase tracking-wide">
                            Real Rev
                          </div>
                        </div>
                      </div>
                      {/* Context: total wagered split, and the gross cut for reference. */}
                      <div className="mt-2 text-white/35 text-[9px] leading-relaxed">
                        Total wagered ETB {money(totalWagered)} = Main{" "}
                        {money(staked)} + Bonus {money(bonus)}. Gross game cut
                        (nominal) was ETB {money(gross)} — it ignores that
                        bonus/bot-funded pots still pay real winnings.
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
            <StatCard
              icon={<GiProfit size={14} />}
              label="Real Staked (Main)"
              value={`ETB ${summaryLoading ? "..." : money(overviewData.realStakeIn)}`}
              color="green"
              subtext={
                !summaryLoading
                  ? "Bet amounts charged from the Main wallet"
                  : null
              }
            />
            <StatCard
              icon={<GiCash size={14} />}
              label="Gross Game Cut"
              value={`ETB ${summaryLoading ? "..." : money(overviewData.systemRevenue)}`}
              color="amber"
              subtext={
                !summaryLoading
                  ? `Nominal cut before bonus — see Real Revenue above for the true bottom line`
                  : null
              }
            />
            <StatCard
              icon={<FaMoneyBillWave size={14} />}
              label="Bonus Wagered"
              value={`ETB ${summaryLoading ? "..." : money(overviewData.bonusWagered)}`}
              color="purple"
              subtext={
                !summaryLoading
                  ? "Bet amounts charged from the Bonus wallet"
                  : null
              }
            />
            <StatCard
              icon={<FaMoneyBillWave size={14} />}
              label="Prizes Paid Out"
              value={`ETB ${summaryLoading ? "..." : money(overviewData.prizesOut)}`}
              color="red"
              subtext={
                !summaryLoading
                  ? "Actual money credited to winners (game_win ledger)"
                  : null
              }
            />
            <StatCard
              icon={<GiRobotGolem size={14} />}
              label="Bot Activity"
              value={`ETB ${summaryLoading ? "..." : money(overviewData.botStakeIn)} BET`}
              color="purple"
              subtext={
                !summaryLoading
                  ? `Won: ETB ${money(overviewData.botWinnings)} · ${overviewData.botCartellas.toLocaleString()} cartellas across ${overviewData.botBetsCount.toLocaleString()} bets`
                  : null
              }
            />
            <StatCard
              icon={<FaUsers size={14} />}
              label="Total Players"
              value={
                summaryLoading
                  ? "..."
                  : overviewData.totalPlayers.toLocaleString()
              }
              color="green"
            />
            <StatCard
              icon={<FaGamepad size={14} />}
              label="Total Games"
              value={
                summaryLoading
                  ? "..."
                  : overviewData.totalGames.toLocaleString()
              }
              color="blue"
            />
            <StatCard
              icon={<FaGamepad size={14} />}
              label="Cartellas Selected"
              value={
                summaryLoading
                  ? "..."
                  : (overviewData.totalCartellas || 0).toLocaleString()
              }
              color="purple"
              subtext={
                !summaryLoading
                  ? [10, 20, 50]
                      .map(
                        (s) =>
                          `${s}: ${(
                            overviewData.cartellasByStake?.[s] || 0
                          ).toLocaleString()}`,
                      )
                      .join("  ·  ")
                  : null
              }
            />
            <StatCard
              icon={<GiCash size={14} />}
              label="Total Deposits"
              value={`ETB ${summaryLoading ? "..." : money(overviewData.totalDeposits)}`}
              color="green"
              subtext={
                !summaryLoading
                  ? `Pending: ${todayDepositMeta.pendingCount} (ETB ${money(todayDepositMeta.pendingTotal)})`
                  : null
              }
            />
            <StatCard
              icon={<FaMoneyBillWave size={14} />}
              label="Total Withdrawals"
              value={`ETB ${summaryLoading ? "..." : money(overviewData.totalWithdrawals)}`}
              color="red"
              subtext={
                !summaryLoading ? (
                  <div className="space-y-0.5 text-white/70 text-[10px]">
                    <div>
                      ✅ Approved: {overviewData.approvedWithdrawalsCount} (ETB{" "}
                      {money(overviewData.approvedWithdrawals)})
                    </div>
                    <div>
                      ⏳ Pending: {overviewData.pendingWithdrawalsCount} (ETB{" "}
                      {money(overviewData.pendingWithdrawals)})
                    </div>
                    {overviewData.processingWithdrawalsCount > 0 && (
                      <div>
                        🔄 Processing: {overviewData.processingWithdrawalsCount}{" "}
                        (ETB {money(overviewData.processingWithdrawals)})
                      </div>
                    )}
                    <div>
                      ❌ Cancelled: {overviewData.cancelledWithdrawalsCount}{" "}
                      (ETB {money(overviewData.cancelledWithdrawals)})
                    </div>
                    {overviewData.failedWithdrawalsCount > 0 && (
                      <div>
                        ⚠️ Failed: {overviewData.failedWithdrawalsCount} (ETB{" "}
                        {money(overviewData.failedWithdrawals)})
                      </div>
                    )}
                  </div>
                ) : null
              }
            />
          </div>
        </motion.div>

        {/* Peak Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <FaChartLine className="text-amber-400" size={12} />
            </div>
            <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider">
              Peak Activity (Last 30 Days)
            </h3>
          </div>

          {peakTimes && peakTimes.totalGames > 0 ? (
            <div className="space-y-3">
              <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-xs font-medium">
                    Peak hours of day
                  </span>
                  <span className="text-amber-400 text-xs font-semibold">
                    Busiest:{" "}
                    {peakTimes.peakHour != null
                      ? formatHour(peakTimes.peakHour)
                      : "—"}
                  </span>
                </div>
                <PeakChart
                  xInterval={2}
                  data={peakTimes.hours.map((h) => ({
                    label: formatHourShort(h.hour),
                    full: formatHour(h.hour),
                    games: h.games,
                    players: h.players,
                    isPeak: h.hour === peakTimes.peakHour,
                  }))}
                />
              </div>

              <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/70 text-xs font-medium">
                    Peak days of week
                  </span>
                  <span className="text-amber-400 text-xs font-semibold">
                    Busiest: {peakTimes.peakDayOfWeek || "—"}
                  </span>
                </div>
                <PeakChart
                  data={peakTimes.daysOfWeek.map((d) => ({
                    label: d.name.slice(0, 3),
                    full: d.name,
                    games: d.games,
                    players: d.players,
                    isPeak: d.name === peakTimes.peakDayOfWeek,
                  }))}
                />
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-4 text-center text-white/50 text-xs">
              {isLoading ? "Loading peak activity…" : "No game activity yet."}
            </div>
          )}
        </motion.div>

        {/* Wallet Totals - All Time (Static) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
              <FaWallet className="text-amber-400" size={12} />
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
              label="Bonus Wallet"
              value={`ETB ${isLoading ? "..." : money(totalBonusWallet)}`}
              color="amber"
            />
          </div>
        </motion.div>

        {/* Detailed Statistics Table */}
        <motion.div
          key={`table-${activePeriod}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden mb-4"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <h3 className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              {tableTitle}
            </h3>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            {!isLoading && currentTableData.length > 0 ? (
              <table className="w-full text-[10px]">
                <thead className="border-b border-white/10 sticky top-0 bg-[#0e1830]/95">
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
                      Real Rev
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
                  {currentTableData.map((stat, index) => (
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
                      <td
                        className={`text-right py-2 px-2 ${
                          (stat.realRevenue || 0) >= 0
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                        title={`Gross cut: ETB ${(stat.systemRevenue || 0).toFixed(2)} · Bonus wagered: ETB ${(stat.bonusWagered || 0).toFixed(2)} · Prizes paid: ETB ${(stat.prizesOut || 0).toFixed(2)}`}
                      >
                        ETB {(stat.realRevenue || 0).toFixed(2)}
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
          className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden"
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
                  <div className="px-2 py-2 bg-white sticky top-0">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-950 text-xs">
                        {group.dateLabel}
                      </span>
                      <span className="text-black text-xs font-medium">
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
                        {/* <th className="text-center py-1 px-2 text-white/30 font-medium">
                          Winner
                        </th> */}
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
                          {/* <td className="text-center py-1 px-2">
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${
                                game.whoWon === "Real"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : game.whoWon === "Bot"
                                    ? "bg-amber-500/20 text-amber-400"
                                    : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {game.whoWon || "—"}
                            </span>
                          </td> */}
                          <td
                            className={`text-right py-1 px-2 ${
                              (game.netRevenue ?? 0) >= 0
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                            title={`Real staked (Main): ETB ${(game.realStakeIn ?? 0).toFixed(2)} · Bonus wagered: ETB ${(game.bonusWagered ?? 0).toFixed(2)} · Prizes paid: ETB ${(game.prizesOut ?? 0).toFixed(2)}`}
                          >
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
