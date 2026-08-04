import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider.jsx";
import { useT } from "../contexts/Languagecontext.jsx";
import { apiFetch } from "../lib/api/client.js";
import { motion } from "framer-motion";
import {
  FaArrowLeft,
  FaCopy,
  FaCheck,
  FaCheckCircle,
  FaClock,
  FaExclamationCircle,
  FaSpinner,
  FaMobileAlt,
  FaUniversity,
} from "react-icons/fa";

const METHOD_ICON = {
  telebirr: <FaMobileAlt size={18} />,
  cbe: <FaUniversity size={18} />,
};

export default function Deposit({ onNavigate }) {
  const { sessionId } = useAuth();
  const t = useT();

  const [methods, setMethods] = useState([]);
  const [minDeposit, setMinDeposit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // method object
  const [sms, setSms] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { type, message, amount }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/sms-forwarder/methods", { sessionId });
        if (cancelled) return;
        setMethods(Array.isArray(res?.methods) ? res.methods : []);
        if (res?.minDeposit) setMinDeposit(res.minDeposit);
      } catch (e) {
        console.error("Load deposit methods failed:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const copyAccount = async () => {
    if (!selected?.account) return;
    try {
      await navigator.clipboard.writeText(selected.account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const submit = async () => {
    if (!sms.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await apiFetch("/sms-forwarder/submit", {
        method: "POST",
        sessionId,
        body: { message: sms.trim(), method: selected?.id },
      });
      if (res?.isVerified) {
        setResult({
          type: "verified",
          message: res.message || t("dep.credited"),
          amount: res.amount,
        });
        setSms("");
      } else {
        setResult({
          type: "pending",
          message: res.message || t("dep.pending"),
          amount: res.amount,
        });
        setSms("");
      }
    } catch (e) {
      // apiFetch throws api_error_<status>; the body carried a message we can't
      // read here, so map by status.
      const m = String(e?.message || "");
      let msg = t("dep.err_generic");
      if (m.includes("400")) msg = t("dep.err_unrecognized");
      setResult({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (selected) {
      setSelected(null);
      setSms("");
      setResult(null);
    } else {
      onNavigate && onNavigate("wallet");
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1220] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-gradient-to-b from-[#0e1830]/95 to-transparent backdrop-blur-md px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            onClick={goBack}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center"
            aria-label="Back"
          >
            <FaArrowLeft size={14} />
          </button>
          <h1 className="text-lg font-bold">{t("dep.title")}</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 text-white/50 text-sm py-16">
            <FaSpinner className="animate-spin" size={14} />
            {t("dep.loading")}
          </div>
        ) : !selected ? (
          /* ---------- Step 1: choose method ---------- */
          <div>
            <p className="text-white/50 text-xs mb-3">{t("dep.choose")}</p>
            <div className="space-y-2.5">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelected(m);
                    setResult(null);
                  }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/10 hover:border-emerald-400/40 transition text-left"
                >
                  <span className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center shrink-0">
                    {METHOD_ICON[m.id] || <FaUniversity size={18} />}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">
                      {m.name}
                    </span>
                    <span className="block text-white/40 text-[11px]">
                      {t("dep.tap_to_pay")}
                    </span>
                  </span>
                  <FaArrowLeft size={12} className="rotate-180 text-white/30" />
                </button>
              ))}
              {methods.length === 0 && (
                <div className="text-center text-white/40 text-sm py-10">
                  {t("dep.no_methods")}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ---------- Step 2: pay + paste SMS ---------- */
          <div className="space-y-4">
            {/* Account card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                  {METHOD_ICON[selected.id] || <FaUniversity size={16} />}
                </span>
                <span className="text-sm font-semibold">{selected.name}</span>
              </div>

              <p className="text-white/40 text-[11px] mb-1">
                {t("dep.send_to")}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-base tracking-wide">
                  {selected.account}
                </div>
                <button
                  onClick={copyAccount}
                  className="px-3 py-2.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  {copied ? <FaCheck size={12} /> : <FaCopy size={12} />}
                  {copied ? t("dep.copied") : t("dep.copy")}
                </button>
              </div>
              {selected.accountName ? (
                <p className="text-white/50 text-[11px] mt-1.5">
                  {t("dep.name")}: {selected.accountName}
                </p>
              ) : null}

              <p className="text-white/50 text-[11px] mt-3 leading-relaxed">
                {selected.instructions}
              </p>
              <p className="text-amber-300/80 text-[11px] mt-1.5">
                {t("dep.min", { min: minDeposit })}
              </p>
            </motion.div>

            {/* Paste SMS */}
            <div>
              <label className="block text-white/60 text-xs font-medium mb-1.5">
                {t("dep.paste_label")}
              </label>
              <textarea
                value={sms}
                onChange={(e) => setSms(e.target.value)}
                rows={5}
                placeholder={t("dep.paste_ph")}
                className="w-full rounded-2xl bg-white/5 border border-white/10 p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            {result && (
              <div
                className={`p-3 rounded-2xl text-sm flex items-start gap-2 ${
                  result.type === "verified"
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : result.type === "pending"
                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                      : "bg-red-500/15 text-red-300 border border-red-500/30"
                }`}
              >
                {result.type === "verified" ? (
                  <FaCheckCircle size={16} className="mt-0.5 shrink-0" />
                ) : result.type === "pending" ? (
                  <FaClock size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <FaExclamationCircle size={16} className="mt-0.5 shrink-0" />
                )}
                <span>
                  {result.message}
                  {result.amount ? (
                    <span className="block font-bold mt-0.5">
                      {Number(result.amount).toLocaleString()} ETB
                    </span>
                  ) : null}
                </span>
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting || !sms.trim()}
              className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <FaSpinner className="animate-spin" size={14} />
                  {t("dep.submitting")}
                </>
              ) : (
                t("dep.submit")
              )}
            </button>

            <button
              onClick={() => {
                setSelected(null);
                setSms("");
                setResult(null);
              }}
              className="w-full py-2 text-white/50 text-xs"
            >
              {t("dep.change_method")}
            </button>
          </div>
        )}
      </div>

      <BottomNav current="wallet" onNavigate={onNavigate} />
    </div>
  );
}
