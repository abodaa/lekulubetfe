import React, { useCallback, useEffect, useState } from "react";
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
  const [feedback, setFeedback] = useState(null);

  // Per-row action state.
  const [confirm, setConfirm] = useState(null); // { id, action: 'approve'|'decline' }
  const [actioningId, setActioningId] = useState(null);

  const load = useCallback(
    async (nextPage, replace) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await apiFetch(
          `/admin/withdrawals?status=${status}&page=${nextPage}&limit=20`,
        );
        const list = Array.isArray(res?.withdrawals) ? res.withdrawals : [];
        setItems((prev) => (replace ? list : [...prev, ...list]));
        setCounts(res?.counts || counts);
        setHasMore(!!res?.hasMore);
        setPage(nextPage);
      } catch (e) {
        console.error("Load withdrawals failed:", e);
        setFeedback({ type: "error", message: "Failed to load withdrawals." });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status],
  );

  useEffect(() => {
    setConfirm(null);
    load(1, true);
  }, [status, load]);

  const act = async (id, action) => {
    setActioningId(id);
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
      load(1, true);
    } finally {
      setActioningId(null);
      setConfirm(null);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
        <FaMoneyBillWave className="text-emerald-400" size={16} />
        Withdrawal Requests
      </h1>

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
              onClick={() => load(page + 1, false)}
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
