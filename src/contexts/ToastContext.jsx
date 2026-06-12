import React, { createContext, useContext, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";

// All app toasts now go through the `react-hot-toast` package. The public API
// (showSuccess / showError / showWarning / ...) is unchanged, so every existing
// call site keeps working — it just renders package toasts instead of the old
// custom implementation.
const ToastContext = createContext(null);

const baseStyle = {
  background: "#0f1830",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "14px",
  fontSize: "13px",
  fontWeight: 600,
  padding: "10px 14px",
  boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
  maxWidth: "92vw",
};

function makeApi() {
  return {
    showSuccess: (message, opts = {}) => toast.success(message, opts),
    showError: (message, opts = {}) => toast.error(message, opts),
    showWarning: (message, opts = {}) =>
      toast(message, { icon: "⚠️", ...opts }),
    showInfo: (message, opts = {}) => toast(message, { icon: "ℹ️", ...opts }),
    showLoading: (message, opts = {}) => toast.loading(message, opts),
    dismiss: (id) => toast.dismiss(id),
    toast, // escape hatch for advanced/custom toasts
  };
}

export function ToastProvider({ children }) {
  const api = useMemo(makeApi, []);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster
        position="top-center"
        gutter={8}
        toastOptions={{
          duration: 3000,
          style: baseStyle,
          success: {
            iconTheme: { primary: "#34d399", secondary: "#0f1830" },
            style: { ...baseStyle, border: "1px solid rgba(52,211,153,0.35)" },
          },
          error: {
            duration: 4000,
            iconTheme: { primary: "#f87171", secondary: "#0f1830" },
            style: { ...baseStyle, border: "1px solid rgba(248,113,113,0.35)" },
          },
          loading: {
            iconTheme: { primary: "#fbbf24", secondary: "#0f1830" },
          },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  // Fall back to the package directly if the provider is somehow absent, so a
  // toast call can never crash a screen.
  return useContext(ToastContext) || makeApi();
}

export default ToastContext;
