import React, { useEffect, useState } from "react";

export default function DebugConsole({ enabled = true }) {
  const [vConsoleInstance, setVConsoleInstance] = useState(null);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    // Only load vConsole in development or when URL param ?debug=true is present
    const urlParams = new URLSearchParams(window.location.search);
    const isDebugMode =
      urlParams.get("debug") === "true" 

    if (!isDebugMode) return;

    const initVConsole = async () => {
      try {
        const VConsole = (await import("vconsole")).default;
        const vc = new VConsole();
        setVConsoleInstance(vc);
        setShowButton(true);
        console.log("✅ vConsole initialized");
        console.log("🔍 Platform:", window.Telegram?.WebApp?.platform);
        console.log("🔍 User Agent:", navigator.userAgent);
      } catch (error) {
        console.error("Failed to load vConsole:", error);
      }
    };

    initVConsole();

    return () => {
      if (vConsoleInstance) {
        vConsoleInstance.destroy();
      }
    };
  }, [enabled]);

  // Optional: Show a manual toggle button
  if (!showButton) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 70,
        right: 10,
        zIndex: 10000,
        backgroundColor: "#10b981",
        color: "white",
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        fontSize: 20,
        fontWeight: "bold",
      }}
      onClick={() => {
        if (vConsoleInstance) {
          vConsoleInstance.show();
        }
      }}
      title="Open Debug Console"
    >
      🐛
    </div>
  );
}
