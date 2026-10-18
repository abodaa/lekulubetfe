import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api/client";
import { motion } from "framer-motion";
import {
  FaGift,
  FaCheckCircle,
  FaExclamationCircle,
  FaSpinner,
  FaSave,
  FaRobot,
  FaGamepad,
  FaPercent,
  FaDice,
} from "react-icons/fa";

// Global settings panel for Bonus Wallet Betting, Bot Management, and Win Steering.
export default function AdminBonusBettingSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // 1. Enable Bot & Selected Amount of Bots
  const [botEnabled, setBotEnabled] = useState(false);
  const [botCount, setBotCount] = useState(5);
  const [botCountInput, setBotCountInput] = useState("5");
  const [botMinCartellas, setBotMinCartellas] = useState(1);
  const [botMinCartellasInput, setBotMinCartellasInput] = useState("1");
  const [botMaxCartellas, setBotMaxCartellas] = useState(3);
  const [botMaxCartellasInput, setBotMaxCartellasInput] = useState("3");

  // 2. Bot Winning Chance for Main Betters
  const [botWinningPercentage, setBotWinningPercentage] = useState(95);
  const [botWinningPercentageInput, setBotWinningPercentageInput] =
    useState("95");

  // 3. Bonus Betters Bot Winner Guarantee & Realistic Turn Range
  const [botSteeringEnabled, setBotSteeringEnabled] = useState(true);
  const [winTurnMin, setWinTurnMin] = useState(18);
  const [winTurnMax, setWinTurnMax] = useState(26);
  const [winTurnMinInput, setWinTurnMinInput] = useState("18");
  const [winTurnMaxInput, setWinTurnMaxInput] = useState("26");

  // 4. Bonus Wallet Betting Global Controls
  const [enabled, setEnabled] = useState(true);
  const [percent, setPercent] = useState(100);
  const [percentInput, setPercentInput] = useState("100");

  const syncStateFromResponse = (res) => {
    setBotEnabled(!!res.botEnabled);
    const bCount = res.botCount == null ? 5 : res.botCount;
    setBotCount(bCount);
    setBotCountInput(String(bCount));

    const bMinC = res.botMinCartellas == null ? 1 : res.botMinCartellas;
    const bMaxC = res.botMaxCartellas == null ? 3 : res.botMaxCartellas;
    setBotMinCartellas(bMinC);
    setBotMinCartellasInput(String(bMinC));
    setBotMaxCartellas(bMaxC);
    setBotMaxCartellasInput(String(bMaxC));

    const bPct =
      res.botWinningPercentage == null ? 95 : res.botWinningPercentage;
    setBotWinningPercentage(bPct);
    setBotWinningPercentageInput(String(bPct));

    setBotSteeringEnabled(res.bonusBotSteeringEnabled !== false);
    const minVal =
      res.bonusBotWinTurnMin == null ? 18 : res.bonusBotWinTurnMin;
    const maxVal =
      res.bonusBotWinTurnMax == null ? 26 : res.bonusBotWinTurnMax;
    setWinTurnMin(minVal);
    setWinTurnMinInput(String(minVal));
    setWinTurnMax(maxVal);
    setWinTurnMaxInput(String(maxVal));

    setEnabled(!!res.bonusBettingEnabled);
    const p = res.bonusBettingPercent == null ? 100 : res.bonusBettingPercent;
    setPercent(p);
    setPercentInput(String(p));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/admin/settings/bonus-betting");
        if (cancelled) return;
        syncStateFromResponse(res);
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
      syncStateFromResponse(res);
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

  const toggleBotEnabled = (nextValue) =>
    handleSave({ botEnabled: nextValue }, (res) =>
      res.botEnabled
        ? `Bot players ENABLED with ${res.botCount} bot(s).`
        : "Bot players DISABLED.",
    );

  const saveBotCount = () => {
    let cnt = Math.max(0, Math.min(100, Math.round(Number(botCountInput) || 0)));
    handleSave(
      { botCount: cnt },
      (res) => `Amount of bot players set to ${res.botCount}.`,
    );
  };

  const saveBotWinningPercentage = () => {
    let pct = Math.max(
      0,
      Math.min(100, Math.round(Number(botWinningPercentageInput) || 0)),
    );
    handleSave(
      { botWinningPercentage: pct },
      (res) => `Bot winning chance for main betters set to ${res.botWinningPercentage}%.`,
    );
  };

  const toggleBotSteering = (nextValue) =>
    handleSave({ bonusBotSteeringEnabled: nextValue }, (res) =>
      res.bonusBotSteeringEnabled
        ? "Bonus betters bot winner guarantee ENABLED (Bot always wins 100%)."
        : "Bonus betters bot winner guarantee DISABLED (The draw is fair).",
    );

  const saveTurnRange = () => {
    let minV = Math.max(
      4,
      Math.min(75, Math.round(Number(winTurnMinInput) || 18)),
    );
    let maxV = Math.max(
      minV,
      Math.min(75, Math.round(Number(winTurnMaxInput) || 26)),
    );
    handleSave(
      { bonusBotWinTurnMin: minV, bonusBotWinTurnMax: maxV },
      (res) =>
        `Bot winning turn range set to ${res.bonusBotWinTurnMin}–${res.bonusBotWinTurnMax}.`,
    );
  };

  const saveBotCartellasRange = () => {
    let minC = Math.max(1, Math.min(5, Math.round(Number(botMinCartellasInput) || 1)));
    let maxC = Math.max(minC, Math.min(5, Math.round(Number(botMaxCartellasInput) || 3)));
    handleSave(
      { botMinCartellas: minC, botMaxCartellas: maxC },
      (res) =>
        `Bot cartellas range set to ${res.botMinCartellas}–${res.botMaxCartellas} per bot.`,
    );
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

  const isTurnRangeUnchanged =
    String(winTurnMin) === winTurnMinInput &&
    String(winTurnMax) === winTurnMaxInput;

  const isCartellasRangeUnchanged =
    String(botMinCartellas) === botMinCartellasInput &&
    String(botMaxCartellas) === botMaxCartellasInput;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] p-4 mb-4"
    >
      <h2 className="text-white text-lg font-bold mb-1 flex items-center gap-2">
        <FaRobot className="text-amber-400" size={18} />
        Bot Players & Bonus Wallet Settings
      </h2>
      <p className="text-white/40 text-[11px] mb-3">
        Configure bot players, bot winning chances for main betters, and bonus
        bettor win guarantees.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-xs py-4">
          <FaSpinner className="animate-spin" size={12} />
          Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {/* 1. Enable Bot -> Enable Bot Players with selected amount of bots */}
          <button
            type="button"
            disabled={saving}
            onClick={() => toggleBotEnabled(!botEnabled)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 disabled:opacity-60 text-left transition-colors hover:bg-white/[0.08]"
          >
            <div>
              <div className="text-white/80 text-xs font-semibold flex items-center gap-1.5">
                <FaRobot
                  size={12}
                  className={botEnabled ? "text-emerald-400" : "text-white/40"}
                />
                1. Enable Bot Players
              </div>
              <div className="text-white/40 text-[10px] mt-0.5 max-w-[280px]">
                {botEnabled
                  ? `Enabled with ${botCount} bot(s). Regardless of player types (main or bonus betters), bots select random cartellas and play.`
                  : "Bots are currently disabled from joining games."}
              </div>
            </div>
            <span
              className={`relative w-10 h-5 rounded-full transition-all shrink-0 ml-3 ${
                botEnabled ? "bg-emerald-500/80" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  botEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {/* Amount of Bots */}
          <div
            className={`px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 ${
              botEnabled ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/70 text-xs font-medium flex items-center gap-1.5">
                <FaGamepad size={12} className="text-sky-400" />
                Selected Amount of Bots
              </span>
              <span className="text-sky-300 text-xs font-bold">
                {botCount} Bots
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={Number(botCountInput) || 1}
                disabled={!botEnabled || saving}
                onChange={(e) => setBotCountInput(e.target.value)}
                className="flex-1 accent-sky-500"
              />
              <input
                type="number"
                min={1}
                max={100}
                value={botCountInput}
                disabled={!botEnabled || saving}
                onChange={(e) => setBotCountInput(e.target.value)}
                className="w-14 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-xs text-center focus:outline-none focus:border-sky-500/50"
              />
              <button
                type="button"
                disabled={
                  !botEnabled || saving || String(botCount) === botCountInput
                }
                onClick={saveBotCount}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-white/30 text-[10px] mt-1.5">
              Regardless of player types (main betters or bonus betters), bots
              select random cartellas and play.
            </p>
          </div>

          {/* 2. Bot Winning Chance for Main Betters */}
          <div className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/70 text-xs font-medium flex items-center gap-1.5">
                <FaDice size={12} className="text-amber-400" />
                2. Bot Winning Chance for Main Betters
              </span>
              <span className="text-amber-300 text-xs font-bold">
                {botWinningPercentage}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Number(botWinningPercentageInput) || 0}
                disabled={saving}
                onChange={(e) => setBotWinningPercentageInput(e.target.value)}
                className="flex-1 accent-amber-500"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={botWinningPercentageInput}
                disabled={saving}
                onChange={(e) => setBotWinningPercentageInput(e.target.value)}
                className="w-14 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-xs text-center focus:outline-none focus:border-amber-500/50"
              />
              <button
                type="button"
                disabled={
                  saving ||
                  String(botWinningPercentage) === botWinningPercentageInput
                }
                onClick={saveBotWinningPercentage}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-white/30 text-[10px] mt-1.5">
              Bot winning chance is configurable for main betters. If there are
              no main betters, bot always wins 100%.
            </p>
          </div>

          {/* 3. Bonus Betters Bot Winner Guarantee */}
          <button
            type="button"
            disabled={saving}
            onClick={() => toggleBotSteering(!botSteeringEnabled)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 disabled:opacity-60 text-left transition-colors hover:bg-white/[0.08]"
          >
            <div>
              <div className="text-white/80 text-xs font-semibold flex items-center gap-1.5">
                <FaGift
                  size={12}
                  className={
                    botSteeringEnabled ? "text-amber-400" : "text-white/40"
                  }
                />
                Bonus Betters Bot Winner Guarantee
              </div>
              <div className="text-white/40 text-[10px] mt-0.5 max-w-[280px]">
                {botSteeringEnabled
                  ? "Only bonus/promo players + Bots: Bot always wins 100%."
                  : "If the bonus betters bot winner guarantee is OFF, the draw is fair."}
              </div>
            </div>
            <span
              className={`relative w-10 h-5 rounded-full transition-all shrink-0 ml-3 ${
                botSteeringEnabled ? "bg-amber-500/80" : "bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  botSteeringEnabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          {/* 4. Realistic Bot Win Turn Range */}
          <div
            className={`px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 ${
              botSteeringEnabled ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/70 text-xs font-medium">
                Realistic Bot Win Turn Range
              </span>
              <span className="text-amber-300 text-xs font-bold">
                Calls {winTurnMin} – {winTurnMax}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-white/40 text-[11px]">Min:</span>
                <input
                  type="number"
                  min={4}
                  max={75}
                  value={winTurnMinInput}
                  disabled={!botSteeringEnabled || saving}
                  onChange={(e) => setWinTurnMinInput(e.target.value)}
                  className="w-14 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-xs text-center focus:outline-none focus:border-amber-500/50"
                />
                <span className="text-white/40 text-[11px] ml-1">Max:</span>
                <input
                  type="number"
                  min={4}
                  max={75}
                  value={winTurnMaxInput}
                  disabled={!botSteeringEnabled || saving}
                  onChange={(e) => setWinTurnMaxInput(e.target.value)}
                  className="w-14 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-xs text-center focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <button
                type="button"
                disabled={
                  !botSteeringEnabled || saving || isTurnRangeUnchanged
                }
                onClick={saveTurnRange}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-white/30 text-[10px] mt-1.5">
              The winning bot completes its pattern between these turn numbers (e.g., 18 to 26).
            </p>
          </div>

          {/* 5. Cartellas per Bot Range */}
          <div
            className={`px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 ${
              botEnabled ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/70 text-xs font-medium">
                Cartellas per Bot (Min–Max)
              </span>
              <span className="text-sky-300 text-xs font-bold">
                {botMinCartellas} – {botMaxCartellas} Cards
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-white/40 text-[11px]">Min:</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={botMinCartellasInput}
                  disabled={!botEnabled || saving}
                  onChange={(e) => setBotMinCartellasInput(e.target.value)}
                  className="w-14 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-xs text-center focus:outline-none focus:border-sky-500/50"
                />
                <span className="text-white/40 text-[11px] ml-1">Max:</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={botMaxCartellasInput}
                  disabled={!botEnabled || saving}
                  onChange={(e) => setBotMaxCartellasInput(e.target.value)}
                  className="w-14 px-2 py-1 rounded-lg bg-white/10 border border-white/20 text-white text-xs text-center focus:outline-none focus:border-sky-500/50"
                />
              </div>
              <button
                type="button"
                disabled={
                  !botEnabled || saving || isCartellasRangeUnchanged
                }
                onClick={saveBotCartellasRange}
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-white/30 text-[10px] mt-1.5">
              How many cartellas each bot selects during a round.
            </p>
          </div>

          {/* 6. Bonus Wallet Betting Global Switch & Usable % */}
          <button
            type="button"
            disabled={saving}
            onClick={() => toggleEnabled(!enabled)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 disabled:opacity-60"
          >
            <span className="text-white/70 text-xs font-medium">
              Allow Bonus Betting (All Users)
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

          <div
            className={`px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 ${
              enabled ? "" : "opacity-50"
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/70 text-xs font-medium">
                Usable Bonus (All Users)
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
                className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <p className="text-white/30 text-[10px] mt-1.5">
              Players can bet with at most this share of their bonus.
            </p>
          </div>

          {/* Status footer */}
          <div className="flex items-center gap-2 text-[11px] text-white/50 pt-1">
            {saving ? (
              <>
                <FaSpinner className="animate-spin" size={10} />
                Saving…
              </>
            ) : (
              <>
                <FaSave size={10} />
                Status: {botEnabled ? `Bots ON (${botCount} bots)` : "Bots OFF"} ·{" "}
                Main betters win rate: {100 - botWinningPercentage}% ·{" "}
                {botSteeringEnabled ? "Bonus guarantee: Bot 100%" : "Bonus guarantee: Fair draw"}
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
