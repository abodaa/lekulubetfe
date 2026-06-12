import React, { createContext, useContext, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";

// All app toasts go through `react-hot-toast`. Each toast is rendered as a
// custom card so it always has a visible × close button, and every toast is
// given a finite duration so it auto-dismisses on its own as well.
const ToastContext = createContext(null);

const DURATIONS = {
  success: 3000,
  error: 4500,
  warning: 4000,
  info: 3500,
  loading: Infinity, // dismissed manually via the returned id
};

const ACCENT = {
  success: { bar: "#34d399", glow: "rgba(52,211,153,0.30)", icon: "✓" },
  error: { bar: "#f87171", glow: "rgba(248,113,113,0.30)", icon: "✕" },
  warning: { bar: "#fbbf24", glow: "rgba(251,191,36,0.30)", icon: "⚠" },
  info: { bar: "#60a5fa", glow: "rgba(96,165,250,0.30)", icon: "ℹ" },
  loading: { bar: "#fbbf24", glow: "rgba(251,191,36,0.30)", icon: "…" },
};

function ToastCard({ t, type, message }) {
  const a = ACCENT[type] || ACCENT.info;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 220,
        maxWidth: "92vw",
        padding: "10px 10px 10px 14px",
        background: "#0f1830",
        color: "#fff",
        border: "1px solid rgba(255,255,255,0.12)",
        borderLeft: `3px solid ${a.bar}`,
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.35,
        boxShadow: `0 10px 30px rgba(0,0,0,0.45), 0 0 0 1px ${a.glow}`,
        opacity: t.visible ? 1 : 0,
        transform: t.visible ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 180ms ease, transform 180ms ease",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 20,
          height: 20,
          display: "grid",
          placeItems: "center",
          borderRadius: 999,
          fontSize: 12,
          color: "#0f1830",
          background: a.bar,
        }}
      >
        {a.icon}
      </span>
      <span style={{ flex: 1, wordBreak: "break-word" }}>{message}</span>
      <button
        onClick={() => toast.dismiss(t.id)}
        aria-label="Close"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          display: "grid",
          placeItems: "center",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          color: "rgba(255,255,255,0.6)",
          background: "rgba(255,255,255,0.08)",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function push(type, message, opts = {}) {
  return toast.custom(
    (t) => <ToastCard t={t} type={type} message={message} />,
    { duration: DURATIONS[type] ?? 3500, ...opts },
  );
}

function makeApi() {
  return {
    showSuccess: (message, opts) => push("success", message, opts),
    showError: (message, opts) => push("error", message, opts),
    showWarning: (message, opts) => push("warning", message, opts),
    showInfo: (message, opts) => push("info", message, opts),
    showLoading: (message, opts) => push("loading", message, opts),
    dismiss: (id) => toast.dismiss(id),
    toast,
  };
}

export function ToastProvider({ children }) {
  const api = useMemo(makeApi, []);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster position="top-center" gutter={8} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || makeApi();
}

export default ToastContext;
