import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaShieldAlt,
  FaSyncAlt,
  FaSpinner,
  FaBan,
  FaUnlock,
  FaUser,
  FaPhone,
  FaExclamationCircle,
  FaCheckCircle,
} from "react-icons/fa";

const WINDOWS = [
  { key: 1, label: "24h" },
  { key: 7, label: "7d" },
  { key: 30, label: "30d" },
];

const SEVERITY_STYLE = {
  high: "bg-red-500/20 text-red-300 border-red-500/40",
  medium: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  low: "bg-sky-500/20 text-sky-300 border-sky-500/40",
};

export default function AdminRiskUsers() {
  const [windowDays, setWindowDays] = useState(7);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [confirm, setConfirm] = useState(null); // { id, action: 'block'|'unblock' }
  const [busyId, setBusyId] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);

  const load = useCallback(
    async (silent) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await apiFetch(
          `/admin/risk/flagged?window=${windowDays}&limit=100`,
        );
        setUsers(Array.isArray(res?.users) ? res.users : []);
        setGeneratedAt(res?.generatedAt || null);
      } catch (e) {
        console.error("Load flagged users failed:", e);
        setFeedback({
          type: "error",
          message: "Failed to load flagged users.",
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [windowDays],
  );

  useEffect(() => {
    setConfirm(null);
    load(false);
  }, [windowDays, load]);

  const act = async (user, action) => {
    setBusyId(user.id);
    setFeedback(null);
    try {
      const reason =
        action === "block"
          ? `Flagged: ${user.flags.map((f) => f.label).join(", ")}`.slice(
              0,
              280,
            )
          : undefined;
      await apiFetch(`/admin/users/${user.id}/${action}`, {
        method: "POST",
        body: action === "block" ? { reason } : {},
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isBlocked: action === "block" } : u,
        ),
      );
      setFeedback({
        type: "success",
        message:
          action === "block"
            ? `${user.name} blocked.`
            : `${user.name} unblocked.`,
      });
    } catch (e) {
      console.error("Block/unblock failed:", e);
      const m = String(e?.message || "");
      setFeedback({
        type: "error",
        message: m.includes("403")
          ? "Not allowed (super admin cannot be blocked)."
          : "Action failed. Please try again.",
      });
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-white text-lg font-bold flex items-center gap-2">
          <FaShieldAlt className="text-red-400" size={16} />
          Flagged Users
        </h1>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing || loading}
          aria-label="Refresh"
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 border border-white/15 text-white/70 hover:text-white hover:bg-white/15 transition disabled:opacity-60"
        >
          <FaSyncAlt size={12} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="text-white/30 text-[10px] mb-3">
        Users with unusual activity over the selected period. Review before
        blocking.
      </p>

      {/* Window selector */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-white/40 text-[10px] shrink-0">Window:</span>
        <div className="flex-1 grid grid-cols-3 gap-1">
          {WINDOWS.map((w) => {
            const active = windowDays === w.key;
            return (
              <button
                key={w.key}
                type="button"
                onClick={() => setWindowDays(w.key)}
                className={`py-1.5 rounded-lg text-[11px] font-medium border transition ${
                  active
                    ? "bg-sky-500/25 text-sky-200 border-sky-400/40"
                    : "bg-white/5 text-white/50 border-white/10 hover:text-white/80"
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-3 p-2 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === "error"
              ? "bg-red-500/20 text-red-300 border border-red-500/30"
              : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
          }`}
        >
          {feedback.type === "error" ? (
            <FaExclamationCircle size={12} />
          ) : (
            <FaCheckCircle size={12} />
          )}
          {feedback.message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-white/50 text-sm py-10">
          <FaSpinner className="animate-spin" size={14} />
          Analyzing…
        </div>
      ) : users.length === 0 ? (
        <div className="text-center text-white/40 text-sm py-10">
          No flagged users in this window. 🎉
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {users.map((u) => (
              <motion.div
                key={u.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className={`bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border p-3 ${
                  u.isBlocked ? "border-red-500/40" : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold flex items-center gap-1.5 truncate">
                      <FaUser className="text-white/40 shrink-0" size={11} />
                      <span className="truncate">{u.name}</span>
                      {u.isBlocked && (
                        <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-red-500/30 text-red-300 shrink-0">
                          Blocked
                        </span>
                      )}
                    </div>
                    {(u.phone || u.username) && (
                      <div className="text-white/40 text-[11px] flex items-center gap-1 mt-0.5">
                        <FaPhone size={9} />
                        {u.phone || `@${u.username}`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 ${
                      SEVERITY_STYLE[u.severity] || SEVERITY_STYLE.low
                    }`}
                  >
                    {u.severity} · {u.score}
                  </span>
                </div>

                {/* Flag chips */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {u.flags.map((f) => (
                    <span
                      key={f.code}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/8 text-white/70 border border-white/10"
                    >
                      {f.label}
                    </span>
                  ))}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
                  <Metric
                    label="Wins"
                    value={`${u.metrics.winCount} (${Math.round(
                      u.metrics.winRate * 100,
                    )}%)`}
                  />
                  <Metric
                    label="Withdrawals"
                    value={`${u.metrics.withdrawCount} · ${u.metrics.withdrawApprovedSum.toLocaleString()}`}
                  />
                  <Metric
                    label="Net profit"
                    value={`${u.metrics.netProfit >= 0 ? "+" : ""}${u.metrics.netProfit.toLocaleString()}`}
                    accent={u.metrics.netProfit > 0 ? "text-emerald-400" : ""}
                  />
                </div>

                {/* Action */}
                <div className="mt-3">
                  {confirm?.id === u.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-white/60 text-[11px] flex-1">
                        {confirm.action === "block"
                          ? "Block this user?"
                          : "Unblock this user?"}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => act(u, confirm.action)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-60 ${
                          confirm.action === "block"
                            ? "bg-red-600"
                            : "bg-emerald-600"
                        }`}
                      >
                        {busyId === u.id ? (
                          <FaSpinner className="animate-spin" size={11} />
                        ) : (
                          "Confirm"
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => setConfirm(null)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/10 text-white/70"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : u.isBlocked ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirm({ id: u.id, action: "unblock" })
                      }
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition"
                    >
                      <FaUnlock size={11} />
                      Unblock
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirm({ id: u.id, action: "block" })}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition"
                    >
                      <FaBan size={11} />
                      Block
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 py-1.5 px-1">
      <div className={`text-xs font-bold ${accent || "text-white"}`}>
        {value}
      </div>
      <div className="text-white/40 text-[9px] uppercase tracking-wide">
        {label}
      </div>
    </div>
  );
}
