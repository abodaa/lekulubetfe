import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaGift,
  FaPercent,
  FaTicketAlt,
  FaClock,
  FaPlusCircle,
  FaBan,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
} from "react-icons/fa";

// Default the datetime-local inputs to a sensible window (now -> +2h), in the
// browser's local time. The backend stores them as Dates.
function toLocalInput(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

const STATUS_STYLES = {
  active: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  scheduled: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  completed: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  expired: "bg-white/10 text-white/40 border-white/10",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

const emptyForm = () => {
  const now = new Date();
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  return {
    type: "deposit_bonus",
    subtype: "cashback",
    title: "",
    description: "",
    startAt: toLocalInput(now),
    endAt: toLocalInput(end),
    // deposit_bonus
    percent: "",
    maxBonus: "",
    minDeposit: "",
    // promo_giveaway
    code: "",
    bonusAmount: "",
    playerCounts: "",
    minGamesToday: "",
  };
};

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const isDeposit = form.type === "deposit_bonus";
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/promotions");
      setPromotions(data?.promotions || []);
    } catch (e) {
      console.error("Load promotions failed:", e);
      setFeedback({ type: "error", message: "Failed to load promotions." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const validate = () => {
    if (!form.startAt || !form.endAt) return "Start and end time are required.";
    if (new Date(form.endAt) <= new Date(form.startAt))
      return "End time must be after start time.";
    if (isDeposit) {
      if (!(Number(form.percent) > 0)) return "Percent must be greater than 0.";
    } else {
      if (!form.code.trim()) return "Promo code is required.";
      if (!(Number(form.bonusAmount) > 0))
        return "Bonus amount must be greater than 0.";
      if (!(Number(form.playerCounts) > 0))
        return "Player count must be greater than 0.";
    }
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setFeedback({ type: "error", message: err });
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    const body = {
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim(),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      enabled: true,
    };
    if (isDeposit) {
      body.subtype = form.subtype;
      body.percent = Number(form.percent) || 0;
      body.maxBonus = Number(form.maxBonus) || 0;
      body.minDeposit = Number(form.minDeposit) || 0;
    } else {
      body.code = form.code.trim().toUpperCase();
      body.bonusAmount = Number(form.bonusAmount) || 0;
      body.playerCounts = Number(form.playerCounts) || 0;
      body.minGamesToday = Number(form.minGamesToday) || 0;
    }

    try {
      await apiFetch("/admin/promotions", { method: "POST", body });
      setFeedback({
        type: "success",
        message: "Promotion scheduled. It will be announced when it goes live.",
      });
      setForm(emptyForm());
      load();
    } catch (e2) {
      const code = e2?.message || "";
      const map = {
        CODE_IN_USE: "That promo code is already in use by an active giveaway.",
        INVALID_WINDOW: "Invalid time window.",
        PERCENT_REQUIRED: "Percent must be greater than 0.",
        CODE_REQUIRED: "Promo code is required.",
        AMOUNT_AND_COUNT_REQUIRED:
          "Bonus amount and player count are required.",
      };
      setFeedback({
        type: "error",
        message: map[code] || "Failed to create promotion. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id) => {
    if (!confirm("Cancel this promotion? It will stop immediately.")) return;
    setCancellingId(id);
    try {
      await apiFetch(`/admin/promotions/${id}/cancel`, { method: "POST" });
      load();
    } catch (e) {
      console.error("Cancel failed:", e);
      setFeedback({ type: "error", message: "Failed to cancel promotion." });
    } finally {
      setCancellingId(null);
    }
  };

  const fmt = (d) =>
    d
      ? new Date(d).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const inputCls =
    "w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-emerald-500/50 transition-all";
  const labelCls = "text-white/60 text-xs font-medium mb-1 block";

  return (
    <div className="max-w-md mx-auto">
      {/* Create card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4 mb-4"
      >
        <h2 className="text-white text-lg font-bold mb-3 flex items-center gap-2">
          <FaGift className="text-pink-400" size={16} />
          Create Promotion
        </h2>

        {/* Type selector */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => set({ type: "deposit_bonus" })}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all ${
              isDeposit
                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                : "bg-white/10 text-white/40 hover:text-white/60"
            }`}
          >
            <FaPercent size={12} />
            Cashback / Happy Hour
          </button>
          <button
            type="button"
            onClick={() => set({ type: "promo_giveaway" })}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all ${
              !isDeposit
                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                : "bg-white/10 text-white/40 hover:text-white/60"
            }`}
          >
            <FaTicketAlt size={12} />
            Promo Code
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {isDeposit ? (
            <>
              <div>
                <label className={labelCls}>Flavour</label>
                <div className="flex gap-2">
                  {["cashback", "happy_hour"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set({ subtype: s })}
                      className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                        form.subtype === s
                          ? "bg-white/20 text-white border border-white/30"
                          : "bg-white/5 text-white/40"
                      }`}
                    >
                      {s === "cashback" ? "💸 Cashback" : "⚡ Happy Hour"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelCls}>Percent %</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.percent}
                    onChange={(e) => set({ percent: e.target.value })}
                    placeholder="e.g. 10"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Max bonus</label>
                  <input
                    type="number"
                    min="0"
                    value={form.maxBonus}
                    onChange={(e) => set({ maxBonus: e.target.value })}
                    placeholder="0 = none"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Min deposit</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minDeposit}
                    onChange={(e) => set({ minDeposit: e.target.value })}
                    placeholder="0"
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-white/40 text-[11px]">
                % of each deposit (capped at max) is added to the user's Bonus
                wallet during the window.
              </p>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Promo code</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) =>
                      set({ code: e.target.value.toUpperCase() })
                    }
                    placeholder="WIN50"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Bonus / user</label>
                  <input
                    type="number"
                    min="0"
                    value={form.bonusAmount}
                    onChange={(e) => set({ bonusAmount: e.target.value })}
                    placeholder="ETB"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Winners (count)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.playerCounts}
                    onChange={(e) => set({ playerCounts: e.target.value })}
                    placeholder="e.g. 100"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Min games today</label>
                  <input
                    type="number"
                    min="0"
                    value={form.minGamesToday}
                    onChange={(e) => set({ minGamesToday: e.target.value })}
                    placeholder="e.g. 3"
                    className={inputCls}
                  />
                </div>
              </div>
              <p className="text-white/40 text-[11px]">
                The first <b>{form.playerCounts || "N"}</b> users who played at
                least <b>{form.minGamesToday || 0}</b> game(s) today and submit{" "}
                <b>/promo {form.code || "CODE"}</b> in the bot get the bonus.
                Auto-disables when full.
              </p>
            </>
          )}

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Starts</label>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => set({ startAt: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Ends</label>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => set({ endAt: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Optional announcement text */}
          <div>
            <label className={labelCls}>Announcement title (optional)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Leave blank for a default message"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Announcement message (optional)</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Custom text broadcast to all users when it goes live"
              className={`${inputCls} resize-none`}
            />
          </div>

          {feedback && (
            <div
              className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${
                feedback.type === "success"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-red-500/15 text-red-300"
              }`}
            >
              {feedback.type === "success" ? (
                <FaCheckCircle size={12} />
              ) : (
                <FaExclamationCircle size={12} />
              )}
              {feedback.message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
              submitting
                ? "bg-white/10 text-white/30 cursor-not-allowed"
                : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg hover:scale-[1.02] active:scale-98"
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <FaSpinner className="animate-spin" size={14} />
                Scheduling...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <FaPlusCircle size={14} />
                Schedule Promotion
              </span>
            )}
          </button>
        </form>
      </motion.div>

      {/* List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4"
      >
        <h3 className="text-white/70 text-xs font-medium uppercase tracking-wider mb-3">
          Promotions
        </h3>

        {loading ? (
          <div className="text-center py-8 text-white/40 text-sm">
            <FaSpinner className="animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : promotions.length === 0 ? (
          <div className="text-center py-8 text-white/40 text-sm">
            No promotions yet.
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {promotions.map((p) => (
                <motion.div
                  key={p._id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-white/5 rounded-xl p-3 border border-white/10"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-semibold">
                          {p.type === "deposit_bonus"
                            ? p.subtype === "happy_hour"
                              ? "⚡ Happy Hour"
                              : "💸 Cashback"
                            : `🎟️ ${p.code}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-medium border ${
                            STATUS_STYLES[p.status] || STATUS_STYLES.expired
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div className="text-white/50 text-[11px] mt-1">
                        {p.type === "deposit_bonus" ? (
                          <>
                            {p.percent}% to Bonus wallet
                            {p.maxBonus > 0 ? ` (max ${p.maxBonus})` : ""}
                            {p.minDeposit > 0
                              ? ` · min deposit ${p.minDeposit}`
                              : ""}
                          </>
                        ) : (
                          <>
                            {p.bonusAmount} ETB · {p.redeemedCount || 0}/
                            {p.playerCounts} claimed
                            {p.minGamesToday
                              ? ` · ${p.minGamesToday}+ games`
                              : ""}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-white/30 text-[10px] mt-1">
                        <FaClock size={8} />
                        {fmt(p.startAt)} → {fmt(p.endAt)}
                      </div>
                    </div>

                    {["scheduled", "active"].includes(p.status) && (
                      <button
                        onClick={() => cancel(p._id)}
                        disabled={cancellingId === p._id}
                        className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-[11px] font-medium hover:bg-red-500/30 transition-all"
                      >
                        {cancellingId === p._id ? (
                          <FaSpinner className="animate-spin" size={10} />
                        ) : (
                          <FaBan size={10} />
                        )}
                        Cancel
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
