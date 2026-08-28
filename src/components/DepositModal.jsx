import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/api/client.js";
import { useT } from "../contexts/Languagecontext.jsx";
import {
  FaTimes,
  FaCopy,
  FaCheck,
  FaSpinner,
  FaCheckCircle,
  FaExclamationTriangle,
  FaChevronLeft,
} from "react-icons/fa";
import { GiMoneyStack } from "react-icons/gi";

// The Verify.ET check can take up to ~30s server-side (see MAX_POLL_MS in
// services/verifyAutoService.js) when the bank's confirmation is queued
// rather than answered inline. The client's default 10s timeout would report
// a false failure while the backend is still legitimately working, so this
// one call needs real headroom.
const VERIFY_TIMEOUT_MS = 35000;

const SUPPORT_URL = "https://t.me/Lekulubingosupport";

/**
 * Deposit modal: method → account details/instructions → paste SMS → verify.
 * Mirrors the Telegram bot's deposit conversation, but as a Mini App screen
 * with a real text-paste box instead of typing into the chat. Runs through
 * the exact same backend pipeline (routes/wallet.js → depositVerificationService),
 * so every rule (settlement-account match, minimum amount, duplicate-receipt
 * protection) applies identically either way.
 */
export default function DepositModal({
  isOpen,
  onClose,
  sessionId,
  onSuccess,
}) {
  const t = useT();

  const [step, setStep] = useState("method"); // method | instructions | paste | verifying | success | error
  const [methods, setMethods] = useState([]);
  const [minDeposit, setMinDeposit] = useState(10);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [smsText, setSmsText] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    // Reset to a clean slate every time the modal opens.
    setStep("method");
    setSelectedMethod(null);
    setSmsText("");
    setResult(null);
    setErrorInfo(null);
    setCopied(false);

    let cancelled = false;
    setMethodsLoading(true);
    apiFetch("/wallet/deposit/methods", { sessionId })
      .then((res) => {
        if (cancelled) return;
        setMethods(res.methods || []);
        setMinDeposit(res.minDeposit || 10);
      })
      .catch((e) => {
        console.error("Load deposit methods failed:", e);
      })
      .finally(() => {
        if (!cancelled) setMethodsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, sessionId]);

  if (!isOpen) return null;

  const handleSelectMethod = (m) => {
    setSelectedMethod(m);
    setStep("instructions");
  };

  const handleCopy = async () => {
    if (!selectedMethod) return;
    try {
      await navigator.clipboard.writeText(selectedMethod.accountNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Copy failed:", e);
    }
  };

  const handleSubmit = async () => {
    if (!smsText.trim() || !selectedMethod) return;
    setStep("verifying");
    setErrorInfo(null);
    try {
      const res = await apiFetch("/wallet/deposit/verify", {
        method: "POST",
        sessionId,
        timeoutMs: VERIFY_TIMEOUT_MS,
        body: { method: selectedMethod.id, smsText: smsText.trim() },
      });
      setResult(res);
      setStep("success");
      onSuccess?.(res);
    } catch (e) {
      console.error("Deposit verify failed:", e);
      // apiFetch attaches the parsed response body as err.body (see
      // src/lib/api/client.js) so the real failure reason survives a non-2xx
      // response instead of collapsing into a generic "api_error_400".
      const code =
        e?.message === "request_timeout" ? "TIMEOUT" : e?.body?.error || null;
      setErrorInfo({
        code,
        amount: e?.body?.amount,
        min: e?.body?.min,
      });
      setStep("error");
    }
  };

  const errorMessage = () => {
    if (!errorInfo) return t("deposit.err_generic");
    const bankLabel = selectedMethod?.label || selectedMethod?.id || "";
    const map = {
      NO_METHOD: t("deposit.err_no_method"),
      UNAVAILABLE: t("deposit.err_unavailable"),
      UNREADABLE: t("deposit.err_unreadable", { bank: bankLabel }),
      ALREADY_CREDITED: t("deposit.err_already_credited"),
      NOT_VERIFIED: t("deposit.err_not_verified"),
      WRONG_ACCOUNT: t("deposit.err_wrong_account"),
      BELOW_MIN: t("deposit.err_below_min", {
        amount: Number(errorInfo.amount || 0).toFixed(1),
        min: errorInfo.min || minDeposit,
      }),
      TIMEOUT: t("deposit.err_timeout"),
      ERROR: t("deposit.err_generic"),
    };
    return map[errorInfo.code] || t("deposit.err_generic");
  };

  const canGoBack = step === "instructions" || step === "paste";

  const handleBack = () => {
    if (step === "instructions") setStep("method");
    else if (step === "paste") setStep("instructions");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="w-full sm:max-w-md bg-[#12141c] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 max-h-[88vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {canGoBack && (
                <button
                  onClick={handleBack}
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                >
                  <FaChevronLeft size={11} />
                </button>
              )}
              <h2 className="text-white text-base font-bold">
                {t("deposit.title")}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <FaTimes size={12} />
            </button>
          </div>

          {/* Step: method selection */}
          {step === "method" && (
            <div>
              <p className="text-white/50 text-xs mb-3">
                {t("deposit.select_method")}
              </p>
              {methodsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <FaSpinner className="animate-spin text-white/40" size={18} />
                </div>
              ) : (
                <div className="space-y-2">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMethod(m)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/40 hover:bg-white/10 transition-all text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                        <GiMoneyStack className="text-amber-400" size={16} />
                      </div>
                      <span className="text-white text-sm font-medium">
                        {m.id === "telebirr"
                          ? t("deposit.method_telebirr")
                          : m.id === "cbe"
                            ? t("deposit.method_cbe")
                            : m.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step: account details + instructions */}
          {step === "instructions" && selectedMethod && (
            <div className="space-y-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/40 text-[11px] uppercase tracking-wider">
                    {t("deposit.account_name")}
                  </span>
                </div>
                <div className="text-white text-sm mb-3">
                  {selectedMethod.accountName}
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-white/40 text-[11px] uppercase tracking-wider">
                    {t("deposit.account_number")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white text-lg font-bold tracking-wide">
                    {selectedMethod.accountNumber}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/30 transition-colors"
                  >
                    {copied ? <FaCheck size={10} /> : <FaCopy size={10} />}
                    {copied ? t("deposit.copied") : t("deposit.copy")}
                  </button>
                </div>
              </div>

              <p className="text-white/60 text-xs whitespace-pre-line leading-relaxed">
                {t("deposit.instructions_steps", { min: minDeposit })}
              </p>

              <button
                onClick={() => setStep("paste")}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold hover:scale-[1.01] transition-transform"
              >
                {t("deposit.continue")}
              </button>
            </div>
          )}

          {/* Step: paste SMS */}
          {step === "paste" && (
            <div className="space-y-3">
              <label className="text-white/50 text-xs block">
                {t("deposit.paste_label")}
              </label>
              <textarea
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                rows={6}
                placeholder={t("deposit.paste_placeholder")}
                className="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm placeholder-white/30 focus:outline-none focus:border-amber-400/50 transition-all resize-none"
                autoFocus
              />
              <button
                onClick={handleSubmit}
                disabled={!smsText.trim()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold hover:scale-[1.01] transition-transform disabled:opacity-40 disabled:hover:scale-100"
              >
                {t("deposit.submit")}
              </button>
            </div>
          )}

          {/* Step: verifying */}
          {step === "verifying" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FaSpinner
                className="animate-spin text-amber-400 mb-4"
                size={28}
              />
              <div className="text-white text-sm font-medium mb-1">
                {t("deposit.verifying_title")}
              </div>
              <div className="text-white/40 text-xs">
                {t("deposit.verifying_sub")}
              </div>
            </div>
          )}

          {/* Step: success */}
          {step === "success" && result && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
                <FaCheckCircle className="text-emerald-400" size={26} />
              </div>
              <div className="text-white text-base font-bold mb-1">
                {t("deposit.success_title")}
              </div>
              <div className="text-white/60 text-sm mb-3">
                {t("deposit.success_message", {
                  amount: Number(result.amount || 0).toFixed(1),
                  main: Number(result.newMainBalance || 0).toFixed(1),
                })}
              </div>
              {result.bonusTotal > 0 && (
                <div className="text-amber-400 text-xs mb-1">
                  {t("deposit.bonus_line", {
                    amount: Number(result.bonusTotal).toFixed(1),
                  })}
                </div>
              )}
              {result.cashback > 0 && (
                <div className="text-amber-400 text-xs mb-3">
                  {t("deposit.promo_line", {
                    amount: Number(result.cashback).toFixed(1),
                  })}
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-semibold"
              >
                {t("deposit.done")}
              </button>
            </div>
          )}

          {/* Step: error */}
          {step === "error" && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
                <FaExclamationTriangle className="text-red-400" size={24} />
              </div>
              <div className="text-white/70 text-sm mb-4">{errorMessage()}</div>
              <div className="w-full flex gap-2">
                <button
                  onClick={() => setStep("paste")}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  {t("deposit.try_again")}
                </button>
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors text-center"
                >
                  {t("deposit.contact_support")}
                </a>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
