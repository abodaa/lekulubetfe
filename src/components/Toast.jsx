import React, { useState, useEffect } from "react";

const Toast = ({ message, type = "error", duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => handleClose(), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  const styles = {
    error: {
      bg: "bg-red-500/10 border-red-500/30",
      icon: "text-red-400",
      text: "text-red-200",
      bar: "bg-red-500",
      emoji: "❌",
    },
    success: {
      bg: "bg-emerald-500/10 border-emerald-500/30",
      icon: "text-emerald-400",
      text: "text-emerald-200",
      bar: "bg-emerald-500",
      emoji: "✅",
    },
    warning: {
      bg: "bg-amber-500/10 border-amber-500/30",
      icon: "text-amber-400",
      text: "text-amber-200",
      bar: "bg-amber-500",
      emoji: "⚠️",
    },
    info: {
      bg: "bg-blue-500/10 border-blue-500/30",
      icon: "text-blue-400",
      text: "text-blue-200",
      bar: "bg-blue-500",
      emoji: "ℹ️",
    },
  };

  const s = styles[type] || styles.error;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full px-4 transition-all duration-300 ease-out ${
        isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
      }`}
    >
      <div
        className={`${s.bg} backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden cursor-pointer`}
        onClick={handleClose}
      >
        {/* Progress bar */}
        <div className="h-1 w-full bg-white/5">
          <div
            className={`h-full ${s.bar} rounded-r-full animate-shrink`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-3">
          <span className={`text-lg flex-shrink-0 ${s.icon}`}>{s.emoji}</span>
          <p className={`flex-1 text-sm font-medium ${s.text}`}>{message}</p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="text-white/30 hover:text-white/70 text-lg font-bold flex-shrink-0 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
