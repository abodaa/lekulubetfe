import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion } from "framer-motion";
import {
  FaUserFriends,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaSave,
} from "react-icons/fa";

export default function AdminReferralSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [agentPercent, setAgentPercent] = useState("");
  const [userPercent, setUserPercent] = useState("");
  const [maxPerDeposit, setMaxPerDeposit] = useState("");
  const [dailyCap, setDailyCap] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/admin/settings/referral");
        if (cancelled) return;
        setEnabled(!!res.referralEnabled);
        setAgentPercent(String(res.referralAgentDepositPercent ?? 0));
        setUserPercent(String(res.referralUserDepositPercent ?? 0));
        setMaxPerDeposit(String(res.referralMaxPerDeposit ?? 0));
        setDailyCap(String(res.referralDailyCapPerInviter ?? 0));
      } catch (e) {
        console.error("Load referral settings failed:", e);
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

  const validPct = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100;
  };

  const handleSave = async () => {
    if (!validPct(agentPercent) || !validPct(userPercent)) {
      setFeedback({
        type: "error",
        message: "Percentages must be between 0 and 100.",
      });
      return;
    }
    const validAmt = (v) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0;
    };
    if (!validAmt(maxPerDeposit) || !validAmt(dailyCap)) {
      setFeedback({
        type: "error",
        message: "Caps must be 0 or a positive amount.",
      });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch("/admin/settings/referral", {
        method: "POST",
        body: {
          referralEnabled: enabled,
          referralAgentDepositPercent: Number(agentPercent),
          referralUserDepositPercent: Number(userPercent),
          referralMaxPerDeposit: Number(maxPerDeposit),
          referralDailyCapPerInviter: Number(dailyCap),
        },
      });
      setEnabled(!!res.referralEnabled);
      setAgentPercent(String(res.referralAgentDepositPercent ?? 0));
      setUserPercent(String(res.referralUserDepositPercent ?? 0));
      setMaxPerDeposit(String(res.referralMaxPerDeposit ?? 0));
      setDailyCap(String(res.referralDailyCapPerInviter ?? 0));
      setFeedback({ type: "success", message: "Referral settings saved." });
    } catch (e) {
      console.error("Save referral settings failed:", e);
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
        <FaUserFriends className="text-amber-400" size={16} />
        Referral Commission
      </h2>
      <p className="text-white/40 text-[11px] mb-3">
        Percentage of every invitee deposit paid to the inviter, credited to
        their Main (withdrawable) wallet.
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
            onClick={() => setEnabled((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10"
          >
            <span className="text-white/70 text-xs font-medium">
              Program enabled
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/50 text-[10px] font-medium mb-1 block">
                Agent inviters (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={agentPercent}
                onChange={(e) => setAgentPercent(e.target.value)}
                disabled={!enabled}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-white/50 text-[10px] font-medium mb-1 block">
                Regular inviters (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={userPercent}
                onChange={(e) => setUserPercent(e.target.value)}
                disabled={!enabled}
                className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          {/* Anti-abuse caps */}
          <div className="pt-1">
            <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-2">
              Caps (0 = no cap)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/50 text-[10px] font-medium mb-1 block">
                  Max per deposit (ETB)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={maxPerDeposit}
                  onChange={(e) => setMaxPerDeposit(e.target.value)}
                  disabled={!enabled}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-white/50 text-[10px] font-medium mb-1 block">
                  Daily cap / inviter (ETB)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={dailyCap}
                  onChange={(e) => setDailyCap(e.target.value)}
                  disabled={!enabled}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-medium flex items-center justify-center gap-1 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            {saving ? (
              <FaSpinner className="animate-spin" size={10} />
            ) : (
              <FaSave size={10} />
            )}
            Save
          </button>

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
