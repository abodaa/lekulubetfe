import React, { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../lib/auth/AuthProvider";
import { useWebSocket } from "../contexts/WebSocketContext";
import lbLogo from "../assets/lb.png";
import { apiFetch, getApiBase } from "../lib/api/client";
import { motion } from "framer-motion";
import { GrInfo } from "react-icons/gr";
import { CiPlay1 } from "react-icons/ci";
import { FaCoins, FaCrown, FaRocket } from "react-icons/fa";

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
        {/* Fixed Header*/}
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-purple-900/95 to-transparent backdrop-blur-md py-2 px-4">
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

        <main className="px-4 pb-24 pt-16">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 mt-4"
          >
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20 backdrop-blur border border-white/20 flex items-center justify-center shadow-xl">
                <span className="text-4xl">🎲</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Let's Play Bingo!
            </h1>
            <p className="text-white/40 text-sm">Select your stake amount</p>
          </motion.div>

          {/* Stake Cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-sm mx-auto space-y-3"
          >
            {/* 10 ETB Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(10)}
              className="group relative rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3 cursor-pointer transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <FaCoins className="text-emerald-400 text-lg" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">
                        10 ETB
                      </span>
                      <span className="text-[10px] text-white/30">Starter</span>
                    </div>
                    <p className="text-white/30 text-[10px]">
                      Perfect for beginners
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                  <span>Play</span>
                  <CiPlay1 size={14} />
                </div>
              </div>
            </motion.div>

            {/* 20 ETB Card - Featured */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(20)}
              className="group relative rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 backdrop-blur border-2 border-blue-400/40 p-3 cursor-pointer transition-all overflow-hidden"
            >
              <div className="absolute -top-1 -right-1 z-50">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-[8px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">
                  POPULAR
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <FaRocket className="text-blue-400 text-lg" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">
                        20 ETB
                      </span>
                      <span className="text-[10px] text-yellow-400/70">
                        Best Value
                      </span>
                    </div>
                    <p className="text-white/30 text-[10px]">
                      Most players choice
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">
                  <span>Play</span>
                  <CiPlay1 size={14} />
                </div>
              </div>
            </motion.div>

            {/* 50 ETB Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => joinStake(50)}
              className="group relative rounded-xl bg-white/5 backdrop-blur border border-white/10 p-3 cursor-pointer transition-all overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <FaCrown className="text-amber-400 text-lg" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-lg">
                        50 ETB
                      </span>
                      <span className="text-[10px] text-white/30">VIP</span>
                    </div>
                    <p className="text-white/30 text-[10px]">
                      For high rollers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-medium">
                  <span>Play</span>
                  <CiPlay1 size={14} />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Admin Announcement */}
          {adminPost && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-sm mx-auto mt-6"
            >
              <div className="rounded-xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
                <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                    {adminPost.kind === "image" ? "LIVE NOW" : "FEATURED"}
                  </span>
                </div>

                {adminPost.kind === "image" ? (
                  <img
                    src={adminPost.url}
                    alt={adminPost.caption || "Announcement"}
                    className="w-full h-36 object-cover"
                    onError={(e) => {
                      e.target.src = lbLogo;
                      e.target.alt = "Lekulu Bingo Logo";
                    }}
                  />
                ) : (
                  <video
                    src={adminPost.url}
                    className="w-full h-36 object-cover"
                    controls
                    muted
                    playsInline
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fallbackImg = document.createElement("img");
                      fallbackImg.src = lbLogo;
                      fallbackImg.alt = "Lekulu Bingo Logo";
                      fallbackImg.className = "w-full h-36 object-cover";
                      e.target.parentNode.insertBefore(fallbackImg, e.target);
                    }}
                  />
                )}

                {adminPost.caption && (
                  <div className="p-2">
                    <p className="text-white/50 text-[10px] leading-relaxed">
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
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="text-white text-lg font-bold mb-1">Navigation Error</h2>
        <p className="text-white/40 text-xs mb-4">
          You have a stake selected but are on the wrong page.
        </p>
        <button
          onClick={() => onNavigate?.("cartela-selection")}
          className="px-5 py-2 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white text-sm font-medium shadow-lg shadow-pink-500/30 hover:scale-105 transition-all active:scale-95"
        >
          Go to Cartella Selection →
        </button>
      </motion.div>
    </div>
  );
}
