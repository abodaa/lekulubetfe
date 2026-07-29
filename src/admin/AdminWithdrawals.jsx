import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaMoneyBillWave,
  FaCheck,
  FaTimes,
  FaSpinner,
  FaUser,
  FaPhone,
  FaClock,
  FaExclamationCircle,
  FaCheckCircle,
  FaSyncAlt,
} from "react-icons/fa";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

const STATUS_STYLE = {
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  declined: "bg-red-500/20 text-red-300 border-red-500/30",
};

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtClock(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function AdminWithdrawals() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    declined: 0,
    all: 0,
  });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Per-row action state.
  const [confirm, setConfirm] = useState(null); // { id, action: 'approve'|'decline' }
  const [actioningId, setActioningId] = useState(null);

  // Refs so the polling interval always reads current values without being
  // torn down and recreated on every state change.
  const pageRef = useRef(1);
  const busyRef = useRef(false); // true while a load/action is in flight
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const load = useCallback(
    async (nextPage, { replace = false, silent = false } = {}) => {
      busyRef.current = true;
      if (replace && !silent) setLoading(true);
      else if (!replace) setLoadingMore(true);
      try {
        const res = await apiFetch(
          `/admin/withdrawals?status=${statusRef.current}&page=${nextPage}&limit=20`,
        );
        const list = Array.isArray(res?.withdrawals) ? res.withdrawals : [];
        setItems((prev) => (replace ? list : [...prev, ...list]));
        if (res?.counts) setCounts(res.counts);
        setHasMore(!!res?.hasMore);
        setPage(nextPage);
        pageRef.current = nextPage;
        setLastUpdated(Date.now());
      } catch (e) {
        console.error("Load withdrawals failed:", e);
        if (!silent)
          setFeedback({
            type: "error",
            message: "Failed to load withdrawals.",
          });
      } finally {
        busyRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    setConfirm(null);
    setItems([]);
    load(1, { replace: true });
  }, [status, load]);

  // Manual refresh — reloads the first page of the current filter without
  // blanking the list.
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(1, { replace: true, silent: true });
    setRefreshing(false);
  }, [load]);

  // Auto-refresh: poll every 15s while the tab is visible. Only silently
  // replaces the list when the admin is on the first page (so a deep scroll
  // isn't yanked back); the per-status counts always update so new pending
  // requests are visible on the badges regardless.
  useEffect(() => {
    const POLL_MS = 15000;
    const tick = () => {
      if (document.hidden) return;
      if (busyRef.current) return; // don't fight an in-flight load/action
      if (pageRef.current === 1) {
        load(1, { replace: true, silent: true });
      } else {
        // Just refresh counts by fetching page 1 counts silently in the
        // background without disturbing the visible (paged) list.
        apiFetch(
          `/admin/withdrawals?status=${statusRef.current}&page=1&limit=1`,
        )
          .then((res) => {
            if (res?.counts) setCounts(res.counts);
            setLastUpdated(Date.now());
          })
          .catch(() => {});
      }
    };
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const act = async (id, action) => {
    setActioningId(id);
    busyRef.current = true;
    setFeedback(null);
    try {
      const path =
        action === "approve"
          ? `/admin/withdrawals/${id}/approve`
          : `/admin/withdrawals/${id}/deny`;
      const res = await apiFetch(path, { method: "POST", body: {} });
      // Remove from the current view if we're not on "all"; on "all" just
      // update its status locally.
      setItems((prev) =>
        status === "all"
          ? prev.map((it) =>
              it.id === id
                ? {
                    ...it,
                    status: action === "approve" ? "approved" : "declined",
                  }
                : it,
            )
          : prev.filter((it) => it.id !== id),
      );
      setCounts((c) => {
        const next = { ...c };
        if (next.pending > 0) next.pending -= 1;
        if (action === "approve") next.approved += 1;
        else next.declined += 1;
        return next;
      });
      setFeedback({
        type: "success",
        message:
          res?.message ||
          (action === "approve"
            ? "Withdrawal approved."
            : "Withdrawal declined."),
      });
    } catch (e) {
      console.error("Withdrawal action failed:", e);
      const m = String(e?.message || "");
      const msg = m.includes("409")
        ? "This request was already processed."
        : m.includes("400")
          ? "Can't process — the user may no longer have enough balance."
          : m.includes("timeout")
            ? "Request timed out. Please retry."
            : "Action failed. Please try again.";
      setFeedback({ type: "error", message: msg });
      // Refresh so the list reflects reality after a conflict.
      load(1, { replace: true, silent: true });
    } finally {
      busyRef.current = false;
      setActioningId(null);
      setConfirm(null);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-white text-lg font-bold flex items-center gap-2">
          <FaMoneyBillWave className="text-emerald-400" size={16} />
          Withdrawal Requests
        </h1>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-white/30 text-[10px]">
              Updated {fmtClock(lastUpdated)}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || loading}
            aria-label="Refresh"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 border border-white/15 text-white/70 hover:text-white hover:bg-white/15 transition disabled:opacity-60"
          >
            <FaSyncAlt size={12} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Auto-refresh note */}
      <p className="text-white/30 text-[10px] mb-2">
        Auto-refreshes every 15s. Tap the icon to check now.
      </p>

      {/* Filter tabs */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {FILTERS.map((f) => {
          const active = status === f.key;
          const count = counts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatus(f.key)}
              className={`py-2 rounded-xl text-[11px] font-semibold border transition ${
                active
                  ? "bg-white/15 text-white border-white/25"
                  : "bg-white/5 text-white/50 border-white/10 hover:text-white/80"
              }`}
            >
              <div>{f.label}</div>
              <div
                className={`text-[10px] mt-0.5 ${
                  active ? "text-emerald-300" : "text-white/30"
                }`}
              >
                {count}
              </div>
            </button>
          );
        })}
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
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center text-white/40 text-sm py-10">
          No {status === "all" ? "" : status} withdrawal requests.
        </div>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {items.map((w) => (
              <motion.div
                key={w.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-semibold flex items-center gap-1.5 truncate">
                      <FaUser className="text-white/40 shrink-0" size={11} />
                      <span className="truncate">
                        {w.user?.name || "Unknown"}
                      </span>
                    </div>
                    {(w.user?.phone || w.user?.username) && (
                      <div className="text-white/40 text-[11px] flex items-center gap-1 mt-0.5">
                        <FaPhone size={9} />
                        {w.user?.phone || `@${w.user?.username}`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-[10px] uppercase px-1.5 py-0.5 rounded border shrink-0 ${
                      STATUS_STYLE[w.status] || STATUS_STYLE.pending
                    }`}
                  >
                    {w.status}
                  </span>
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="text-emerald-400 text-lg font-bold leading-none">
                      ETB {Number(w.amount).toLocaleString()}
                    </div>
                    {w.destination && (
                      <div className="text-white/50 text-[11px] mt-1">
                        To: {w.destination}
                      </div>
                    )}
                  </div>
                  <div className="text-white/30 text-[10px] flex items-center gap-1">
                    <FaClock size={9} />
                    {fmtDate(w.createdAt)}
                  </div>
                </div>

                {w.status === "pending" && (
                  <div className="mt-3">
                    {confirm?.id === w.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-white/60 text-[11px] flex-1">
                          {confirm.action === "approve"
                            ? "Approve & pay out?"
                            : "Decline this request?"}
                        </span>
                        <button
                          type="button"
                          disabled={actioningId === w.id}
                          onClick={() => act(w.id, confirm.action)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white disabled:opacity-60 ${
                            confirm.action === "approve"
                              ? "bg-emerald-600"
                              : "bg-red-600"
                          }`}
                        >
                          {actioningId === w.id ? (
                            <FaSpinner className="animate-spin" size={11} />
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={actioningId === w.id}
                          onClick={() => setConfirm(null)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/10 text-white/70"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setConfirm({ id: w.id, action: "approve" })
                          }
                          className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600/90 text-white hover:bg-emerald-600 transition"
                        >
                          <FaCheck size={11} />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirm({ id: w.id, action: "decline" })
                          }
                          className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-red-600/90 text-white hover:bg-red-600 transition"
                        >
                          <FaTimes size={11} />
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {w.status !== "pending" && w.processedByName && (
                  <div className="mt-2 text-white/30 text-[10px]">
                    By {w.processedByName} · {fmtDate(w.processedAt)}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {hasMore && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => load(page + 1, {})}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-xs font-medium disabled:opacity-60"
            >
              {loadingMore ? (
                <span className="flex items-center justify-center gap-2">
                  <FaSpinner className="animate-spin" size={11} />
                  Loading…
                </span>
              ) : (
                "Load more"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
