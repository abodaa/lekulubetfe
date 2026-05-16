import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { useWebSocket } from "../contexts/WebSocketContext";
import lbLogo from "../assets/lb.png";
import { apiFetch, getApiBase } from "../lib/api/client";
import { motion } from "framer-motion";

export default function Game({ onNavigate, onStakeSelected, selectedStake }) {
  const [adminPost, setAdminPost] = useState(null);
  const apiBase = getApiBase();
  const { sessionId } = useAuth();
  useWebSocket();

  useEffect(() => {
    let isMounted = true;
    const loadAdminPost = async () => {
      try {
        const data = await apiFetch("/admin/posts", {
          method: "GET",
          timeoutMs: 20000,
        });
        const posts = Array.isArray(data?.posts) ? data.posts : [];
        const active = posts.find((p) => p?.active === true) || null;
        if (active) {
          const url = active.url?.startsWith("http")
            ? active.url
            : `${apiBase}${active.url}`;
          if (isMounted) setAdminPost({ ...active, url });
        } else {
          if (isMounted) setAdminPost(null);
        }
      } catch (e) {
        console.error("Failed to load admin post:", e);
        if (isMounted) setAdminPost(null);
      }
    };
    loadAdminPost();
    return () => {
      isMounted = false;
    };
  }, [apiBase]);

  const joinStake = (s) => {
    onStakeSelected?.(s);
  };

  // Show initial screen when no stake is selected
  if (!selectedStake) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <header className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shadow-lg">
                <img
                  src={lbLogo}
                  alt="Lekulu Bingo Logo"
                  className="w-6 h-6 object-contain"
                />
              </div>
              <span className="text-white font-bold text-lg tracking-wide">
                Lekulu Bingo
              </span>
            </div>
            <button
              onClick={() => onNavigate?.("rules")}
              className="px-4 py-2 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all active:scale-95"
            >
              <span className="flex items-center gap-1">
                <span>❓</span>
                <span>Rules</span>
              </span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 pb-24">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mt-8 mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">
              Welcome to Lekulu Bingo
            </h1>
            <p className="text-white/60 text-sm">
              Choose your stake to start playing
            </p>
          </motion.div>

          {/* Stake Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-sm mx-auto"
          >
            {/* 10 ETB Card */}
            <div
              onClick={() => joinStake(10)}
              className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-green-600/20 backdrop-blur border border-emerald-400/30 p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/30 flex items-center justify-center">
                    <span className="text-2xl">🎮</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">10 ETB</h3>
                    <p className="text-white/50 text-xs">Starter Pack</p>
                  </div>
                </div>
                <div className="px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-bold">
                  Play →
                </div>
              </div>
            </div>

            {/* 20 ETB Card */}
            <div
              onClick={() => joinStake(20)}
              className="mb-4 rounded-2xl bg-gradient-to-r from-blue-500/20 to-indigo-600/20 backdrop-blur border border-blue-400/30 p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/30 flex items-center justify-center">
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">20 ETB</h3>
                    <p className="text-white/50 text-xs">Popular Choice</p>
                  </div>
                </div>
                <div className="px-4 py-2 rounded-full bg-blue-500 text-white text-sm font-bold">
                  Play →
                </div>
              </div>
            </div>

            {/* 50 ETB Card */}
            <div
              onClick={() => joinStake(50)}
              className="mb-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-600/20 backdrop-blur border border-amber-400/30 p-4 cursor-pointer transition-all hover:scale-[1.02] active:scale-98"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/30 flex items-center justify-center">
                    <span className="text-2xl">🏆</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl">50 ETB</h3>
                    <p className="text-white/50 text-xs">High Roller</p>
                  </div>
                </div>
                <div className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-bold">
                  Play →
                </div>
              </div>
            </div>
          </motion.div>

          {/* Admin Announcement */}
          {adminPost && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-sm mx-auto mt-6"
            >
              <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
                {/* Live Badge */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
                    {adminPost.kind === "image" ? "LIVE" : "VIDEO"}
                  </span>
                </div>

                {/* Media */}
                {adminPost.kind === "image" ? (
                  <img
                    src={adminPost.url}
                    alt={adminPost.caption || "Announcement"}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.target.src = lbLogo;
                      e.target.alt = "Lekulu Bingo Logo";
                    }}
                  />
                ) : (
                  <video
                    src={adminPost.url}
                    className="w-full h-48 object-cover"
                    controls
                    muted
                    playsInline
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fallbackImg = document.createElement("img");
                      fallbackImg.src = lbLogo;
                      fallbackImg.alt = "Lekulu Bingo Logo";
                      fallbackImg.className = "w-full h-48 object-cover";
                      e.target.parentNode.insertBefore(fallbackImg, e.target);
                    }}
                  />
                )}

                {/* Caption */}
                {adminPost.caption && (
                  <div className="p-3 border-t border-white/10">
                    <p className="text-white/70 text-xs leading-relaxed">
                      {adminPost.caption}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </main>

        <BottomNav current="game" onNavigate={onNavigate} />
      </div>
    );
  }

  // If stake is selected, this component shouldn't be rendered
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <span className="text-4xl">⚠️</span>
        </div>
        <h2 className="text-white text-xl font-bold mb-2">Navigation Error</h2>
        <p className="text-white/50 text-sm mb-6">
          You have a stake selected but are on the wrong page.
        </p>
        <button
          onClick={() => onNavigate?.("cartela-selection")}
          className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg shadow-pink-500/30 hover:scale-105 transition-all active:scale-95"
        >
          Go to Cartella Selection →
        </button>
      </div>
    </div>
  );
}
