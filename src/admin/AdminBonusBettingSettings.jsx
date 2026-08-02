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
  const [percent, setPercent] = useState(100);
  const [percentInput, setPercentInput] = useState("100");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/admin/settings/bonus-betting");
        if (cancelled) return;
        setEnabled(!!res.bonusBettingEnabled);
        const p =
          res.bonusBettingPercent == null ? 100 : res.bonusBettingPercent;
        setPercent(p);
        setPercentInput(String(p));
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

  const handleSave = async (patch, successMsg) => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch("/admin/settings/bonus-betting", {
        method: "POST",
        body: patch,
      });
      setEnabled(!!res.bonusBettingEnabled);
      const p = res.bonusBettingPercent == null ? 100 : res.bonusBettingPercent;
      setPercent(p);
      setPercentInput(String(p));
      setFeedback({ type: "success", message: successMsg(res) });
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

  const toggleEnabled = (nextValue) =>
    handleSave({ bonusBettingEnabled: nextValue }, (res) =>
      res.bonusBettingEnabled
        ? "Bonus betting enabled for all users."
        : "Bonus betting disabled for all users.",
    );

  const savePercent = () => {
    let p = Math.max(0, Math.min(100, Math.round(Number(percentInput) || 0)));
    handleSave(
      { bonusBettingPercent: p },
      (res) => `Global bonus usable set to ${res.bonusBettingPercent}%.`,
    );
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
        Controls whether players can bet using their Bonus wallet, and how much
        of it. When off, bonus is frozen for everyone. The percentage caps how
        much of each player's bonus is usable for betting (e.g. 50% = half). You
        can override both per user from their profile.
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
            onClick={() => toggleEnabled(!enabled)}
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

          {/* Usable percentage */}
          <div
            className={`px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 ${
              enabled ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/70 text-xs font-medium">
                Usable bonus (all users)
              </span>
              <span className="text-sky-300 text-xs font-bold">{percent}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Number(percentInput) || 0}
                disabled={!enabled || saving}
                onChange={(e) => setPercentInput(e.target.value)}
                className="flex-1 accent-sky-500"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={percentInput}
                disabled={!enabled || saving}
                onChange={(e) => setPercentInput(e.target.value)}
                className="w-14 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-xs text-center focus:outline-none focus:border-sky-500/50"
              />
              <button
                type="button"
                disabled={
                  !enabled || saving || String(percent) === percentInput
                }
                onClick={savePercent}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-sky-600 text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <p className="text-white/30 text-[10px] mt-1.5">
              Players can bet with at most this share of their bonus.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-white/50">
            {saving ? (
              <>
                <FaSpinner className="animate-spin" size={10} />
                Saving…
              </>
            ) : (
              <>
                <FaSave size={10} />
                Current: {enabled
                  ? `Enabled · ${percent}% usable`
                  : "Disabled"}{" "}
                for all users
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
