import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { useWebSocket } from "../contexts/WebSocketContext";
import lbLogo from "../assets/lb.png";
import { apiFetch, getApiBase } from "../lib/api/client";
import { motion } from "framer-motion";
import { GrInfo } from "react-icons/gr";
import { CiPlay1 } from "react-icons/ci";

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
      <div className="h-[100dvh] bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        {/* Fixed Header with safe area for Telegram */}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/95 to-transparent backdrop-blur-md pt-safe py-2 px-4">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <img
              src={lbLogo}
              alt="Lekulu Bingo Logo"
              className="w-10 h-10 object-contain rounded-full flex items-center justify-center border border-white/20"
            />
            <button
              onClick={() => onNavigate?.("rules")}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 backdrop-blur border border-white/20 text-white text-sm font-semibold hover:bg-white/20 transition-all active:scale-95"
            >
              <span className="flex items-center gap-1">
                <span>
                  <GrInfo />
                </span>
              </span>
            </button>
          </div>
        </div>

        <main className="px-4 pb-24 pt-24">
          {/* Hero Section with Animated Bingo Ball */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-2xl animate-bounce-slow">
                <span className="text-5xl">🎲</span>
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold animate-pulse">
                HOT
              </div>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white mb-3 tracking-tight">
              Welcome to
              <br />
              <span className="bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text uppercase text-transparent">
                Lekulu Bingo
              </span>
            </h1>
            <p className="text-white/50 text-sm">
              Choose your stake to start playing
            </p>
          </motion.div>

          {/* Stake Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-sm mx-auto space-y-4"
          >
            {/* 10 ETB Card */}
            <motion.div
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(10)}
              className="group relative rounded-2xl bg-gradient-to-r from-emerald-500/20 to-green-600/20 backdrop-blur border border-emerald-400/30 p-4 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-3xl">🎮</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-2xl">10 ETB</h3>
                    <p className="text-white/40 text-xs">Starter Pack</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/30 group-hover:shadow-emerald-500/50 transition-all">
                  <p>Play</p>
                  <CiPlay1 />
                </div>
              </div>
            </motion.div>

            {/* 20 ETB Card - Featured */}
            <motion.div
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(20)}
              className="group relative rounded-2xl bg-gradient-to-r from-blue-500/20 to-indigo-600/20 backdrop-blur border-2 border-blue-400/50 p-4 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-3xl">🎯</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-2xl">20 ETB</h3>
                    <p className="text-white/40 text-xs">Popular Choice</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-500 text-white text-sm font-bold shadow-lg shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all">
                  <p>Play</p>
                  <CiPlay1 />
                </div>
              </div>
            </motion.div>

            {/* 50 ETB Card */}
            <motion.div
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(50)}
              className="group relative rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-600/20 backdrop-blur border border-amber-400/30 p-4 cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <span className="text-3xl">🏆</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-2xl">50 ETB</h3>
                    <p className="text-white/40 text-xs">High Roller</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-white text-sm font-bold shadow-lg shadow-amber-500/30 group-hover:shadow-amber-500/50 transition-all">
                  <p>Play</p>
                  <CiPlay1 />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Admin Announcement */}
          {adminPost && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="max-w-sm mx-auto mt-8"
            >
              <div className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
                      {adminPost.kind === "image" ? "LIVE" : "VIDEO"}
                    </span>
                  </div>
                  <div className="text-white/30 text-[10px]">
                    📢 ANNOUNCEMENT
                  </div>
                </div>

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
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center"
      >
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
      </motion.div>
    </div>
  );
}
