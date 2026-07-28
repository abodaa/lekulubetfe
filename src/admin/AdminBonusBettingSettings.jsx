import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion } from "framer-motion";
import {
  FaGift,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaSave,
} from "react-icons/fa";

// Global switch: may users bet with their Bonus wallet?
// This is the "all users" control. Per-user exceptions are set from the
// individual user's detail panel (which can force-allow or force-disallow and
// override this default).
export default function AdminBonusBettingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/admin/settings/bonus-betting");
        if (cancelled) return;
        setEnabled(!!res.bonusBettingEnabled);
      } catch (e) {
        console.error("Load bonus-betting settings failed:", e);
        if (!cancelled)
          setFeedback({ type: "error", message: "Failed to load settings." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (nextValue) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch("/admin/settings/bonus-betting", {
        method: "POST",
        body: { bonusBettingEnabled: nextValue },
      });
      setEnabled(!!res.bonusBettingEnabled);
      setFeedback({
        type: "success",
        message: res.bonusBettingEnabled
          ? "Bonus betting enabled for all users."
          : "Bonus betting disabled for all users.",
      });
    } catch (e) {
      console.error("Save bonus-betting settings failed:", e);
      setFeedback({
        type: "error",
        message: "Failed to save. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-4 mb-4"
    >
      <h2 className="text-white text-lg font-bold mb-1 flex items-center gap-2">
        <FaGift className="text-sky-400" size={16} />
        Bonus Wallet Betting
      </h2>
      <p className="text-white/40 text-[11px] mb-3">
        Controls whether players can place game bets using their Bonus wallet.
        When off, bonus balances are frozen from betting for everyone — main
        wallet must cover the stake. You can still force-allow or force-disallow
        individual users from their profile.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-xs py-4">
          <FaSpinner className="animate-spin" size={12} />
          Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {/* Enable toggle */}
          <button
            type="button"
            disabled={saving}
            onClick={() => handleSave(!enabled)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-60"
          >
            <span className="text-white/70 text-xs font-medium">
              Allow bonus betting (all users)
            </span>
            <span
              className={`relative w-10 h-5 rounded-full transition-all ${
                enabled ? "bg-emerald-500/70" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  enabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <div className="flex items-center gap-2 text-[11px] text-white/50">
            {saving ? (
              <>
                <FaSpinner className="animate-spin" size={10} />
                Saving…
              </>
            ) : (
              <>
                <FaSave size={10} />
                Current: {enabled ? "Enabled" : "Disabled"} for all users
              </>
            )}
          </div>

          {feedback && (
            <div
              className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
                feedback.type === "error"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
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
        </div>
      )}
    </motion.div>
  );
}
