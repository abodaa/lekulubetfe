import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion } from "framer-motion";
import {
  FaPaperPlane,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaSave,
  FaInfoCircle,
  FaTelegramPlane,
} from "react-icons/fa";

export default function AdminPromoChannelSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [testFeedback, setTestFeedback] = useState(null);

  const [channelId, setChannelId] = useState("");
  const [channelEnabled, setChannelEnabled] = useState(true);
  const [broadcastEnabled, setBroadcastEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/admin/settings/promo-channel");
        if (cancelled) return;
        setChannelId(res.promoChannelId || "");
        setChannelEnabled(res.promoChannelEnabled !== false);
        setBroadcastEnabled(!!res.promoBroadcastToUsers);
      } catch (e) {
        console.error("Load promo channel settings failed:", e);
        if (!cancelled)
          setFeedback({
            type: "error",
            message: "Failed to load channel settings.",
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await apiFetch("/admin/settings/promo-channel", {
        method: "POST",
        body: {
          promoChannelId: channelId.trim(),
          promoChannelEnabled: channelEnabled,
          promoBroadcastToUsers: broadcastEnabled,
        },
      });
      setChannelId(res.promoChannelId || "");
      setChannelEnabled(res.promoChannelEnabled !== false);
      setBroadcastEnabled(!!res.promoBroadcastToUsers);
      setFeedback({
        type: "success",
        message: "Telegram promotion channel settings saved.",
      });
    } catch (e) {
      console.error("Save promo channel settings failed:", e);
      setFeedback({
        type: "error",
        message: e?.message || "Failed to save settings. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!channelId.trim()) {
      setTestFeedback({
        type: "error",
        message: "Please enter a Channel ID or @username first.",
      });
      return;
    }
    setTesting(true);
    setTestFeedback(null);
    try {
      const res = await apiFetch("/admin/promo-channel/test", {
        method: "POST",
        body: { promoChannelId: channelId.trim() },
      });
      setTestFeedback({
        type: "success",
        message: `Connection successful! Sent test message to ${res.channel || channelId}.`,
      });
    } catch (e) {
      console.error("Test channel connection failed:", e);
      setTestFeedback({
        type: "error",
        message:
          e?.message ||
          "Could not send message. Check bot admin rights in channel.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-4 mb-4"
    >
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white text-lg font-bold flex items-center gap-2">
          <FaTelegramPlane className="text-sky-400" size={18} />
          Dedicated Promo Channel
        </h2>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
            channelEnabled && channelId.trim()
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-white/10 text-white/40 border-white/15"
          }`}
        >
          {channelEnabled && channelId.trim() ? "Active" : "Not Configured"}
        </span>
      </div>

      <p className="text-white/50 text-[11px] mb-3">
        Promotions are posted to this channel with interactive one-tap claim
        buttons. Subscribers claim their bonus directly in the channel without
        leaving!
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-xs py-4">
          <FaSpinner className="animate-spin" size={12} />
          Loading channel settings…
        </div>
      ) : (
        <div className="space-y-3">
          {/* Channel ID / Username Input */}
          <div>
            <label className="text-white/60 text-xs font-medium mb-1 block">
              Channel @Username or Chat ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="@my_promo_channel or -100xxxxxxxxxx"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-sky-400/50 transition-all"
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing || !channelId.trim()}
                className="px-3 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-semibold hover:bg-sky-500/30 transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                {testing ? (
                  <FaSpinner className="animate-spin" size={12} />
                ) : (
                  <FaPaperPlane size={11} />
                )}
                Test
              </button>
            </div>
          </div>

          {/* Test feedback */}
          {testFeedback && (
            <div
              className={`flex items-start gap-2 p-2.5 rounded-xl text-xs ${
                testFeedback.type === "success"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-red-500/15 text-red-300 border border-red-500/30"
              }`}
            >
              {testFeedback.type === "success" ? (
                <FaCheckCircle className="flex-shrink-0 mt-0.5" size={12} />
              ) : (
                <FaExclamationCircle className="flex-shrink-0 mt-0.5" size={12} />
              )}
              <span>{testFeedback.message}</span>
            </div>
          )}

          {/* Channel Enabled Switch */}
          <button
            type="button"
            onClick={() => setChannelEnabled((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-all"
          >
            <div className="text-left">
              <span className="text-white/80 text-xs font-medium block">
                Auto-post active promotions to channel
              </span>
              <span className="text-white/40 text-[10px] block">
                Automatically posts when promo begins with live claim button
              </span>
            </div>
            <span
              className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${
                channelEnabled ? "bg-sky-500/80" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  channelEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {/* DM Broadcast Switch */}
          <button
            type="button"
            onClick={() => setBroadcastEnabled((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] transition-all"
          >
            <div className="text-left">
              <span className="text-white/80 text-xs font-medium block">
                Also broadcast direct message (DM) to all users
              </span>
              <span className="text-white/40 text-[10px] block">
                Sends a private Telegram message in addition to the channel post
              </span>
            </div>
            <span
              className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${
                broadcastEnabled ? "bg-sky-500/80" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  broadcastEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {/* Quick Setup Instructions Callout */}
          <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-sky-200/80 text-[11px] space-y-1">
            <div className="font-semibold text-sky-300 flex items-center gap-1.5 mb-1">
              <FaInfoCircle size={12} />
              Setup in 3 Easy Steps:
            </div>
            <div>
              1. Add your Telegram bot as an <b>Administrator</b> in your channel.
            </div>
            <div>
              2. Grant the bot <b>&quot;Post Messages&quot;</b> permission.
            </div>
            <div>
              3. Enter your channel&apos;s <b>@username</b> above and click <b>Test</b>!
            </div>
          </div>

          {/* Save feedback */}
          {feedback && (
            <div
              className={`flex items-start gap-2 p-2.5 rounded-xl text-xs ${
                feedback.type === "success"
                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                  : "bg-red-500/15 text-red-300 border border-red-500/30"
              }`}
            >
              {feedback.type === "success" ? (
                <FaCheckCircle className="flex-shrink-0 mt-0.5" size={12} />
              ) : (
                <FaExclamationCircle className="flex-shrink-0 mt-0.5" size={12} />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
              saving
                ? "bg-white/10 text-white/30 cursor-not-allowed"
                : "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg hover:scale-[1.01] active:scale-98"
            }`}
          >
            {saving ? (
              <>
                <FaSpinner className="animate-spin" size={12} />
                Saving Channel Settings…
              </>
            ) : (
              <>
                <FaSave size={12} />
                Save Channel Settings
              </>
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
